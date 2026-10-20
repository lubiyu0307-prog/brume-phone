// Instagram：妳的帳號在看。有他的貼文和限時動態，也有卡裡的配角、符合世界觀的路人。
// 妳可以發真的照片（他會看到照片本身來留言）、按愛心、留言（發文的人會回）、看他的個人頁。
// 他的照片先是文字描述，點進去可以叫 Gemini 生圖。
// 配角的大頭貼由玩家自己放（點配角的頭像，或相本的證件照區）：卡片作者不一定會做，玩家可以拿作者宣傳時附的配角照片來用。

import * as store from './store.js';
import { currentChar, generate, imagine, canSeeImages, imageInfo, canDraw, worldRoster } from './st.js';
import { imagineAndPick, chooseEngine } from './pick.js';
import { P } from './prompts.js';
import { promptEditor } from './promptedit.js';
import { HIM, ME, loadCast, saveCast as storeCast, person, setPerson, refsFor, idsFor, finalPrompt, ensureAutoStyle, shotRules, shotIds, shotInAfterEdit, isSavedImage, savedImagePrompt, shotHand } from './cast.js';

// 自動生圖：打開的話，他新發的貼文用 Gemini 畫成真的照片（一張要等一下）
const AUTO_KEY = 'brume-phone:igauto';
const autoOn = () => { try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; } };
const canImagine = () => canDraw();

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const fmt = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}萬` : String(n || 0));
function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  if (s < 604800) return `${Math.floor(s / 86400)} 天前`;
  const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function parseJSON(raw) {
  const t = raw.replace(/```(?:json)?/gi, '');
  const i = t.search(/[[{]/); if (i < 0) throw new Error('沒有生出內容');
  const close = t[i] === '{' ? '}' : ']';
  return JSON.parse(t.slice(i, t.lastIndexOf(close) + 1));
}
const KIND = { 本人: 'him', 配角: 'other', 路人: 'other' };
const WORLD = '- 配角和路人的身分、語氣、話題都要符合現實世界、現在的台灣（2026 年）';

const IC = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
  heartOn: '<svg viewBox="0 0 24 24" fill="#ff3040" stroke="#ff3040" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4.5-4.5"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-5.5 7.5-5.5s6.3 1.5 7.5 5.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
};

export function createIG({ screen, say }) {
  let people = { cast: {}, look: { him: '', me: '' } }; let castEdit = null; // 證件照（cast.js），照角色卡存
  let ch = null; let d = null; let view = 'feed'; let openId = null; let profileOf = 'me'; let loading = false; let story = null; let back = 'feed';
  const mine = () => !!screen.querySelector('.bp-ig');
  const save = () => ch && store.set('ig:' + ch.key, d).catch(() => {});
  const saveCast = () => ch && storeCast(ch.charKey, people);
  const find = (id) => d.posts.find((p) => p.id === id);
  const meA = () => ({ kind: 'me', name: ch.user, handle: d.me.handle });
  const himA = () => ({ kind: 'him', name: ch.name, handle: d.him.handle });

  function av(a, cls = '') {
    if (a.kind === 'him' && ch.avatar) return `<img class="bp-ig-av ${cls}" src="${ch.avatar}" alt="">`;
    if (a.kind === 'me' && d.me.avatar) return `<img class="bp-ig-av ${cls}" src="${d.me.avatar}" alt="">`;
    const tap = a.kind === 'other' ? ` data-cast="${esc(a.name)}"` : '';
    const pic = a.kind === 'other' && people.cast[a.name]?.photo;
    if (pic) return `<img class="bp-ig-av ${cls}"${tap} src="${pic}" alt="">`;
    return `<span class="bp-ig-av ${cls}"${tap} style="--h:${hue(a.handle)}">${esc((a.name || '?').slice(0, 1))}</span>`;
  }
  const photo = (p, cls = '') => (p.img
    ? `<img class="bp-ig-img ${cls}" src="${esc(p.img)}" alt="" data-igphoto="${p.id}">`
    : `<div class="bp-ig-img card ${cls}" style="--h:${hue(p.desc)}" data-igphoto="${p.id}"><span>${esc(p.desc)}</span>${p.author.kind !== 'me' ? '<small class="bp-ig-lphint">長按生成照片</small>' : ''}</div>`);

  function post(p, detail) {
    const n = p.comments?.length || 0;
    return `<article class="bp-ig-post">
      <header data-prof="${p.author.kind}"${p.author.kind === 'other' ? ` data-cast="${esc(p.author.name)}"` : ''}>${av(p.author, 'sm')}<b>${esc(p.author.handle)}</b><i data-igmore="${p.id}">${IC.more}</i></header>
      <div ${detail ? '' : `data-post="${p.id}"`}>${photo(p)}</div>
      <div class="bp-ig-acts"><span data-like="${p.id}">${p.liked ? IC.heartOn : IC.heart}</span><span data-post="${p.id}">${IC.comment}</span><span>${IC.send}</span><span class="r">${IC.save}</span></div>
      <p class="bp-ig-likes">${fmt(p.likes + (p.liked ? 1 : 0))} 個讚</p>
      ${p.caption ? `<p class="bp-ig-cap"><b>${esc(p.author.handle)}</b> ${esc(p.caption)}</p>` : ''}
      ${!detail && n ? `<p class="bp-ig-more" data-post="${p.id}">查看全部 ${n} 則留言</p>` : ''}
      <p class="bp-ig-time">${ago(p.ts)}</p>
    </article>`;
  }

  function tabs(on) {
    return `<nav class="bp-ig-tabs"><span data-ig="feed" class="${on === 'feed' ? 'on' : ''}">${IC.home}</span><span data-ig="compose">${IC.plus}</span><span data-ig="profme" class="${on === 'me' ? 'on' : ''}">${IC.user}</span></nav>`;
  }

  async function render() {
    ch = currentChar();
    if (!ch) { screen.innerHTML = `<div class="bp-ig"><div class="bp-ig-head"><span class="bp-back" data-ig="home">‹</span><b class="logo">Instagram</b><span></span></div><p class="bp-ig-empty">先在酒館選一個角色。</p></div>`; return; }
    d = (await store.get('ig:' + ch.key).catch(() => null)) || { me: { handle: '', bio: '' }, him: { handle: '', bio: '' }, posts: [], stories: [] };
    d.me.handle ||= ch.user; d.him.handle ||= ch.name;
    people = await loadCast(ch.charKey);
    if (view === 'post' && find(openId)) renderPost(); else if (view === 'profile') renderProfile(); else renderFeed();
    if (view === 'feed' && !d.posts.some((p) => p.author.kind !== 'me') && !loading) refresh();
  }

  // 重畫動態或個人頁時留在原本捲到的位置：長按生完圖整頁重畫會跳回第一張（10/19 比比）
  // 每一頁各記自己捲到哪（一邊捲一邊記），點進貼文看留言再按上一頁也回到同一張
  const tops = {};
  screen.addEventListener('scroll', (e) => { if (mine() && e.target?.classList?.contains('bp-ig-scroll')) tops[view] = e.target.scrollTop; }, true);
  const keepScroll = (name, draw) => { draw(); const sc = screen.querySelector('.bp-ig-scroll'); if (sc && tops[name]) sc.scrollTop = tops[name]; };
  function renderFeed() { keepScroll('feed', renderFeed0); }
  function renderProfile() { keepScroll('profile', renderProfile0); }
  function renderFeed0() {
    view = 'feed';
    const stories = d.stories.filter((s) => Date.now() - s.ts < 864e5);
    const people = [...new Map(stories.map((s) => [s.author.handle, s])).values()];
    const posts = [...d.posts].sort((a, b) => b.ts - a.ts);
    screen.innerHTML = `<div class="bp-ig">
      <div class="bp-ig-head"><span class="bp-back" data-ig="home">‹</span><b class="logo">Instagram</b><span class="bp-ig-tools">${canImagine() ? `<em class="bp-ig-auto${autoOn() ? ' on' : ''}" data-ig="auto">${autoOn() ? '自動生圖' : '文字照片'}</em>` : ''}<i class="${loading ? 'spin' : ''}" data-ig="refresh">${IC.refresh}</i></span></div>
      <div class="bp-ig-scroll">
        <div class="bp-ig-stories">
          <div class="bp-ig-story me" data-ig="compose">${av(meA())}<span>你的限動</span></div>
          ${people.map((s) => `<div class="bp-ig-story${stories.filter((x) => x.author.handle === s.author.handle).every((x) => x.seen) ? ' seen' : ''}" data-story="${esc(s.author.handle)}">${av(s.author)}<span>${esc(s.author.handle)}</span></div>`).join('')}
        </div>
        ${loading ? '<p class="bp-ig-empty">動態更新中⋯</p>' : ''}
        ${posts.map((p) => post(p)).join('')}
      </div>${tabs('feed')}</div>`;
  }

  function renderProfile0() {
    view = 'profile';
    const isMe = profileOf === 'me';
    const a = isMe ? meA() : himA(); const info = isMe ? d.me : d.him;
    const ps = d.posts.filter((p) => p.author.kind === (isMe ? 'me' : 'him')).sort((x, y) => y.ts - x.ts);
    screen.innerHTML = `<div class="bp-ig">
      <div class="bp-ig-head"><span class="bp-back" data-ig="${isMe ? 'feed' : 'back'}">‹</span><b>${esc(a.handle)}</b><span></span></div>
      <div class="bp-ig-scroll">
        <div class="bp-ig-prof">${av(a, 'lg')}
          <div><b>${ps.length}</b><span>貼文</span></div><div><b>${fmt(info.followers || (isMe ? 128 : 312))}</b><span>粉絲</span></div><div><b>${fmt(info.following || (isMe ? 201 : 87))}</b><span>追蹤中</span></div></div>
        <p class="bp-ig-bio"><b>${esc(a.name)}</b>${info.bio ? `<br>${esc(info.bio)}` : ''}</p>
        ${isMe ? '<div class="bp-ig-profbtns"><button data-ig="editme">編輯個人檔案</button><button data-ig="avatar">換頭貼</button></div>' : ''}
        <div class="bp-ig-grid">${ps.map((p) => `<div data-post="${p.id}">${photo(p, 'sq')}</div>`).join('')}</div>
        ${ps.length ? '' : `<p class="bp-ig-empty">${isMe ? '還沒有貼文。按下面的 ＋ 發第一篇。' : '還沒有貼文。'}</p>`}
      </div>${tabs(isMe ? 'me' : '')}
      <input class="bp-ig-file" type="file" accept="image/*" hidden></div>`;
  }

  function renderPost() {
    view = 'post';
    const p = find(openId);
    screen.innerHTML = `<div class="bp-ig">
      <div class="bp-ig-head"><span class="bp-back" data-ig="back">‹</span><b>貼文</b><span></span></div>
      <div class="bp-ig-scroll">
        ${post(p, true)}
        <div class="bp-ig-comments">
          ${p.loading ? '<p class="bp-ig-empty">留言載入中⋯</p>' : ''}
          ${(p.comments || []).map((c) => `<div class="bp-ig-c">${av(c.author, 'xs')}<p><b>${esc(c.author.handle)}</b> ${esc(c.text)}<small>${ago(c.ts)}</small></p></div>`).join('')}
        </div>
      </div>
      <form class="bp-ig-bar">${av(meA(), 'xs')}<input placeholder="以 ${esc(d.me.handle)} 的身分留言⋯" enterkeyhint="send"><button>發佈</button></form></div>`;
  }

  function composer() {
    screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-sheet"><div>
      <div class="bp-ig-sheet-top"><u data-ig="unsheet">取消</u><b>新貼文</b><u data-ig="share" class="ok">分享</u></div>
      <div class="bp-ig-pick" data-ig="pick"><span>點這裡選一張照片</span></div>
      <textarea placeholder="寫點說明文字⋯" rows="3"></textarea>
      <label class="bp-ig-asstory"><input type="checkbox"> 發成限時動態</label>
      <input class="bp-ig-file" type="file" accept="image/*" hidden></div></div>`);
  }

  // ---------- 生成 ----------
  async function refresh() {
    if (loading || !ch) return;
    loading = true; if (view === 'feed') renderFeed();
    const who = ch; const dd = d;
    try {
      // 你們相本裡的照片，他可以挑一張自己發（發過的不再給）
      dd.usedAlbum ||= [];
      const album = ((await store.get('album:' + who.key).catch(() => null)) || [])
        .filter((p) => p.img && !dd.usedAlbum.includes(p.id) && p.desc && p.desc !== '妳放的照片').slice(-6);
      const have = dd.posts.slice(-10).map((p) => `${p.author.handle}：${p.caption.slice(0, 20)}`).join('\n');
      const r = parseJSON(await generate([
        await worldRoster(),
        '[Brume Phone · Instagram]',
        `現在不是在寫劇情正文。${who.user} 在滑 Instagram。請寫動態上新的 4 篇貼文和 2 則限時動態：`,
        `- 貼文 1～2 篇是 ${who.name} 本人發的，照他的個性、生活和最近發生的事；其他是角色卡、世界書裡的配角或路人`,
        `- 限時動態至少 1 則是 ${who.name} 的，比貼文更隨性`,
        WORLD, `- 不要寫 ${who.user} 發的`,
        `- photo 裡如果拍到 ${who.name} 或 ${who.user}（就算是別人偷拍、路人拍到、只當配角），一定要寫出名字（例如「${who.name}坐在窗邊看書」），不要只用職業或「那個男生」「一個女生」帶過`,
        '- 真實存在的名人（歌手、演員）入鏡時，photo 寫成台下遠遠拍的、背影、剪影或舞台燈光下看不清臉的樣子，不要臉部特寫（生圖畫不出真人的臉，也不該畫）',
        '- photo 會拿去生圖，要寫清楚畫面裡有誰；發文的人的手、手臂、腳或身體入鏡時，寫明是誰的、男生還是女生的（例如「他骨節分明的男生手掌托著⋯」），不要只寫「手」',
        shotRules(people, who),
        `- ${who.name} 的帳號用：${dd.him.handle === who.name ? '幫他取一個英文小寫帳號' : dd.him.handle}`,
        have ? `已經有的（不要重複）：\n${have}` : '',
        album.length ? `${who.name} 和 ${who.user} 相本裡的合照（${who.name} 想曬的話，可以拿其中一張發，在那篇加 "album":編號；不想就不用）：\n${album.map((p, i) => `${i + 1}. ${p.desc}`).join('\n')}` : '',
        '', '只輸出 JSON：{"posts":[{"type":"本人/配角/路人","name":"","handle":"英文小寫帳號","photo":"照片拍到什麼，一句話","shot":"","in":[],"caption":"說明文字","likes":120,"album":0}],"stories":[{"type":"","name":"","handle":"","photo":"畫面","shot":"","in":[],"text":"限動上的字"}]}',
      ].filter(Boolean).join('\n')));
      const now = Date.now();
      const author = (x) => {
        const kind = KIND[x.type] || 'other';
        if (kind === 'him') {
          if (dd.him.handle === who.name && x.handle) {
            dd.him.handle = String(x.handle).replace(/^@/, '');
            for (const q of dd.posts) if (q.author.kind === 'him') q.author.handle = dd.him.handle; // 之前用名字當帳號發的也一起換
          }
          return himA();
        }
        return { kind, name: String(x.name || '路人'), handle: String(x.handle || x.name || 'user').replace(/^@/, '').slice(0, 24) };
      };
      (r.posts || []).forEach((x, i) => {
        const a = author(x);
        const pic = a.kind === 'him' && +x.album > 0 ? album[+x.album - 1] : null;
        if (pic) dd.usedAlbum.push(pic.id);
        dd.posts.push({ id: uid(), author: a, desc: pic ? pic.desc : String(x.photo || ''), ...(pic ? { img: pic.img, fromAlbum: true } : shotOf(x)), caption: String(x.caption || ''), likes: +x.likes || Math.floor(Math.random() * 200), ts: now - (i + Math.random()) * 3 * 36e5, comments: null });
      });
      (r.stories || []).forEach((x, i) => dd.stories.push({ id: uid(), author: author(x), desc: String(x.photo || ''), ...shotOf(x), text: String(x.text || ''), ts: now - i * 2 * 36e5, seen: false }));
      dd.posts = dd.posts.slice(-80); dd.stories = dd.stories.filter((s) => now - s.ts < 864e5);
      if (who.key === ch?.key) save();
    } catch (e) { say(`動態更新失敗：${e.message || e}`); }
    loading = false;
    if (mine() && view === 'feed') renderFeed();
    autoDraw(who, dd);
  }

  // 模型寫的 shot、in 收進貼文或限動；沒寫就照舊從 desc 猜
  const shotOf = (x) => (x && String(x.shot || '').trim() ? { shot: String(x.shot).trim(), in: Array.isArray(x.in) ? x.in.map(String) : [] } : {});

  // 照片的生圖 prompt：照片裡有誰入鏡，就帶誰的長相和證件照，最後套上玩家寫的照片風格
  function photoPrompt(p, who, story = false) {
    // 寫照片時一起寫好的畫面描述：入鏡的人照 in，不再從描述裡猜
    if (p.shot && isSavedImage(p.shot)) return { prompt: savedImagePrompt(p.shot), refs: [] };
    if (p.shot) {
      const ids = shotIds(people, who, p.in);
      const author = p.author.kind === 'other' ? p.author.name : p.author.kind === 'him' ? HIM : null;
      const by = author && !ids.includes(author) ? author : undefined;
      return { prompt: finalPrompt(people, who, `${p.shot}${story ? P.IG_STORY : P.IG_POST}`, ids, { by, hand: shotHand(p.shot) }), refs: refsFor(people, who, '', ids) };
    }
    // 發文的人本人入鏡（自拍、對鏡、合照）才帶他的長相和照片；描述裡只有「他的手」不算，那是第一人稱視角
    // 倒影也算入鏡：隔著玻璃拍企鵝，玻璃上映出他拿手機的樣子（10/15 那張臉不是他）
    const self = /自拍|鏡子|鏡中|對鏡|合照|入鏡|露臉|全身照|倒影|反射|映在|映出|鏡面|reflection/i.test(p.desc);
    const author = p.author.kind === 'other' ? p.author.name : p.author.kind === 'him' ? HIM : null;
    const always = self && author ? [author] : [];
    // 別人拍到他或妳：描述裡寫到名字（或名字裡的字，像「阿愷」）也帶證件照（10/15 動物園粉專拍到飼育員侯愷，沒帶到他的照片）
    // 名字後面接的是手、手掌、手指（「格骨節分明的男生手掌拿著⋯」）只是他的手入鏡，不算整個人入鏡：
    // 帶證件照會把整張臉畫進去（10/15 霧靈晨那張，第一人稱拍晨，卻冒出他的大臉）
    const esc2 = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 單字的名字（像「格」）會撞到「風格」「格子」，不自動判斷，靠自拍、合照這些字
    const nameHit = (n) => n && n.length >= 2 && [n, ...(n.length >= 2 ? [`阿${n.slice(-1)}`, `小${n.slice(-1)}`] : [])]
      .some((x) => new RegExp(`${esc2(x)}(?![^，。,、]{0,10}(手|指|臂|掌))`).test(p.desc));
    if (nameHit(who.name) && !always.includes(HIM)) always.push(HIM);
    if (nameHit(who.user) && !always.includes(ME)) always.push(ME);
    const ids = idsFor(people, p.desc, always);
    const by = author;
    const refs = refsFor(people, who, p.desc, always);
    // 沒寫入鏡，但 Gemini 常自己在玻璃、櫥窗畫出拍照的人：照片照樣帶上，註明「萬一出現才用」，出現了臉也會對
    // 只有場景裡有玻璃、櫥窗、水面這種會映出人的東西才帶（flash 看到照片就想把人畫進去）
    if (!self && author && /玻璃|櫥窗|窗|水面|水族|螢幕|反光|glass|window/i.test(p.desc)) {
      const [r] = refsFor(people, who, '', [author]);
      if (r && !refs.some((x) => x.url === r.url)) refs.push({ name: r.name, url: r.url, ghost: true });
    }
    return { prompt: finalPrompt(people, who, `${p.desc}${story ? P.IG_STORY : P.IG_POST}`, ids, { by }), refs };
  }
  // 限動是直的（9:16），貼文是方的
  // pick：玩家自己按的才讓她挑（一次生幾張照證件照頁的設定）；自動生圖在背景跑，只生一張
  const draw = async (p, who, aspect = '1:1', pick = false) => {
    // 玩家自己按的：兩家都有金鑰先問用哪家（只有一家不問）；背景自動生的照證件照頁的預設
    const engine = pick ? await chooseEngine(screen) : '';
    if (pick && !engine) return '';
    await ensureAutoStyle(people, who.charKey); const { prompt, refs } = photoPrompt(p, who, aspect === '9:16');
    const full = prompt;
    const url = pick ? await imagineAndPick(screen, full, { refs, aspect, engine }) : await imagine(full, { refs, aspect });
    if (!url && imageInfo.why) say(`沒有出圖：${imageInfo.why}`);
    else if (url && imageInfo.switched) say(imageInfo.switched);
    return url;
  };

  // 配角的證件照：一張照片（當大頭貼，也是生圖的參考）＋長相文字。相本的證件照區是同一份
  function castSheet(name) {
    const c = person(people, ch, name);
    castEdit = { name, photo: c.photo };
    screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-sheet"><div>
      <div class="bp-ig-sheet-top"><u data-ig="unsheet">取消</u><b>${esc(name)}</b><u data-ig="savecast" class="ok">完成</u></div>
      <div class="bp-ig-pick round bp-ig-castpic" data-ig="castpic">${c.photo ? `<img src="${c.photo}" alt="">` : '<span>放一張照片</span>'}</div>
      <label>長相與身形（生圖會照這段，選填）</label><textarea class="bp-ig-look" rows="3" placeholder="髮色髮型、身材、常穿的衣服。例如：黑色短髮，圓框眼鏡，嬌小，常穿灰色帽 T">${esc(c.look)}</textarea>
      <p class="bp-ig-casthint">照片會當 ${esc(name)} 的大頭貼，生 ${esc(name)} 入鏡的照片時也會給 Gemini 看，長得比較像。同一張角色卡的每個聊天都用這份，相本的「證件照」也看得到。</p>
      ${c.photo || c.look ? '<p class="bp-ig-casthint"><u data-ig="castclear">清掉</u></p>' : ''}
      <input class="bp-ig-file" type="file" accept="image/*" hidden></div></div>`);
  }
  function rerender() { view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed(); }
  // 把他剛發、還是文字卡的貼文一張一張畫出來
  async function autoDraw(who, dd) {
    if (!autoOn() || !canImagine()) return;
    for (const p of dd.posts.filter((x) => x.author.kind === 'him' && !x.img && !x.drawn).slice(-2)) {
      p.drawn = true; // 失敗也不重試，免得每次重整都卡在同一張
      const url = await draw(p, who);
      if (url) { p.img = url; if (who.key === ch?.key) { save(); if (mine() && view === 'feed') renderFeed(); } else store.set('ig:' + who.key, dd).catch(() => {}); }
    }
    for (const s of dd.stories.filter((x) => x.author.kind === 'him' && !x.img && !x.drawn).slice(-1)) {
      s.drawn = true;
      const url = await draw(s, who, '9:16');
      if (url) { s.img = url; if (who.key === ch?.key) save(); else store.set('ig:' + who.key, dd).catch(() => {}); }
    }
  }

  async function loadComments(p) {
    p.loading = true; p.comments = []; renderPost();
    const who = ch;
    try {
      const r = parseJSON(await generate([
        await worldRoster(),
        '[Brume Phone · Instagram]',
        `現在不是在寫劇情正文。這是 Instagram 上一篇貼文，請寫底下的 3～5 則留言。`,
        `發文的人：${p.author.kind === 'him' ? `${who.name} 本人` : p.author.kind === 'me' ? `${who.user} 本人` : p.author.name}（@${p.author.handle}）`,
        `照片：${p.img && p.author.kind === 'me' ? '（附在這則訊息裡）' : p.desc}`, `說明：${p.caption}`,
        p.author.kind === 'me' ? `- 這是 ${who.user} 發的，${who.name} 一定會留言，照你們現在的關係，看得出他對她的在意` : `- ${who.name} 想留言的話也可以`,
        WORLD, `- 不要寫 ${who.user} 的留言`,
        '', `只輸出 JSON：[{"type":"本人/配角/路人","name":"","handle":"","text":""}]（本人＝${who.name}）`,
      ].join('\n'), p.author.kind === 'me' ? p.img : undefined));
      const now = Date.now();
      p.comments = (Array.isArray(r) ? r : []).map((x, i) => ({ id: uid(), author: KIND[x.type] === 'him' ? himA() : { kind: 'other', name: String(x.name || ''), handle: String(x.handle || x.name || 'user').replace(/^@/, '') }, text: String(x.text || ''), ts: Math.min(now, p.ts + (i + 1) * (5 + Math.random() * 30) * 60000) }));
    } catch (e) { p.comments = []; say(`留言載入失敗：${e.message || e}`); }
    p.loading = false; save();
    if (mine() && view === 'post' && openId === p.id) renderPost();
  }

  async function reply(p, text) {
    const who = ch;
    p.comments ||= [];
    p.comments.push({ id: uid(), author: meA(), text, ts: Date.now() });
    save(); renderPost();
    try {
      const r = parseJSON(await generate([
        await worldRoster(),
        '[Brume Phone · Instagram]',
        `現在不是在寫劇情正文。${who.user}（@${d.me.handle}）在一篇貼文底下留言了，請寫接下來的 1～2 則回覆。`,
        `- 優先是發文的 @${p.author.handle} 回她；${p.author.kind === 'him' ? '' : `${who.name} 也可以插一句`}`, WORLD,
        `貼文：${p.desc}／${p.caption}`, `留言串：\n${p.comments.slice(-10).map((c) => `@${c.author.handle}：${c.text}`).join('\n')}`,
        '', `只輸出 JSON：[{"type":"本人/配角/路人","name":"","handle":"","text":""}]（本人＝${who.name}）`,
      ].join('\n')));
      for (const x of Array.isArray(r) ? r : []) {
        const author = KIND[x.type] === 'him' ? himA() : (p.comments.find((c) => c.author.name === x.name)?.author || (p.author.name === x.name ? p.author : { kind: 'other', name: String(x.name || ''), handle: String(x.handle || 'user').replace(/^@/, '') }));
        p.comments.push({ id: uid(), author, text: String(x.text || ''), ts: Date.now() });
      }
      save();
    } catch (e) { say(`沒有人回：${e.message || e}`); }
    if (mine() && view === 'post' && openId === p.id) renderPost();
  }

  // ---------- 事件 ----------
  let pendingImg = null;
  screen.addEventListener('click', async (e) => {
    if (!mine()) return;
    // 貼文右上角 ⋯：重寫這篇、刪除這篇
    const more = e.target.closest('[data-igmore]');
    if (more) { postMenu(more.dataset.igmore); return; }
    const mm = e.target.closest('[data-igm]');
    if (mm) {
      const p = find(mm.dataset.id); const a = mm.dataset.igm;
      screen.querySelector('.bp-ig-menu')?.remove();
      if (a === 'del' && p) { d.posts = d.posts.filter((x) => x !== p); save(); if (view === 'post') view = back; view === 'profile' ? renderProfile() : renderFeed(); say('刪掉了'); }
      if (a === 'redo' && p) await rewritePost(p);
      return;
    }
    // 限動列上的配角頭像：先看限動，不是跳證件照表單（10/19 比比：配角帳號那麼多不可能一個一個放，而且這樣看不到限動）。
    // 要改配角的證件照，從貼文的帳號名或個人頁點
    const cs = e.target.closest('[data-cast]');
    if (cs && !e.target.closest('.bp-ig-storyv') && !e.target.closest('[data-story]')) { castSheet(cs.dataset.cast); return; }
    const lk = e.target.closest('[data-like]');
    if (lk) { const p = find(lk.dataset.like); p.liked = !p.liked; save(); view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed(); return; }
    const pr = e.target.closest('[data-prof]');
    if (pr && pr.dataset.prof !== 'other') { back = view; profileOf = pr.dataset.prof; renderProfile(); return; }
    const op = e.target.closest('[data-post]');
    if (op && view !== 'post') { back = view; openId = op.dataset.post; renderPost(); const p = find(openId); if (!p.comments) loadComments(p); return; }
    const st = e.target.closest('[data-story]');
    if (st) { const list = d.stories.filter((s) => s.author.handle === st.dataset.story && Date.now() - s.ts < 864e5); story = { list, i: 0 }; showStory(); return; }
    if (e.target.closest('[data-ig="sgen"]')) {
      const s = story.list[story.i]; const btn = e.target.closest('button'); btn.disabled = true; btn.textContent = '生圖中⋯';
      const url = await draw(s, ch, '9:16', true);
      if (url) { s.img = url; save(); } else say('沒有出圖：可能被擋了，或酒館還沒接生圖');
      if (screen.querySelector('.bp-ig-storyv') && story.list[story.i] === s) showStory();
      return;
    }
    if (e.target.closest('.bp-ig-storyv')) {
      story.list[story.i].seen = true; story.i++; save();
      if (story.i < story.list.length) { showStory(); return; }
      // 這個帳號的看完了：接著看限動列上的下一個帳號，全部看完才回動態（10/19 比比：跟真的 IG 一樣）
      const fresh = d.stories.filter((s) => Date.now() - s.ts < 864e5);
      const handles = [...new Set(fresh.map((s) => s.author.handle))];
      const next = handles[handles.indexOf(story.list[0]?.author.handle) + 1];
      if (next) { story = { list: fresh.filter((s) => s.author.handle === next), i: 0 }; showStory(); return; }
      screen.querySelector('.bp-ig-storyv')?.remove(); renderFeed(); return;
    }
    const a = e.target.closest('[data-ig]')?.dataset.ig;
    if (!a) return;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'feed') renderFeed();
    if (a === 'back') { back === 'profile' && view === 'post' ? renderProfile() : renderFeed(); }
    if (a === 'refresh') refresh();
    if (a === 'profme') { profileOf = 'me'; renderProfile(); }
    if (a === 'compose') { pendingImg = null; composer(); }
    if (a === 'unsheet') screen.querySelector('.bp-ig-sheet')?.remove();
    if (a === 'pick' || a === 'avatar' || a === 'castpic') { const f = screen.querySelector('.bp-ig-sheet .bp-ig-file') || screen.querySelector('.bp-ig-file'); f.dataset.for = a; f.click(); }
    if (a === 'editme') {
      screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-sheet"><div>
        <div class="bp-ig-sheet-top"><u data-ig="unsheet">取消</u><b>編輯個人檔案</b><u data-ig="saveme" class="ok">完成</u></div>
        <label>帳號</label><input class="bp-ig-h" value="${esc(d.me.handle)}"><label>簡介</label><textarea class="bp-ig-b" rows="3">${esc(d.me.bio)}</textarea></div></div>`);
    }
    if (a === 'saveme') { d.me.handle = screen.querySelector('.bp-ig-h').value.trim().replace(/^@/, '') || ch.user; d.me.bio = screen.querySelector('.bp-ig-b').value.trim(); d.posts.forEach((p) => { if (p.author.kind === 'me') p.author.handle = d.me.handle; }); save(); screen.querySelector('.bp-ig-sheet')?.remove(); renderProfile(); }
    if (a === 'share') {
      if (!pendingImg) { say('先選一張照片'); return; }
      const cap = screen.querySelector('.bp-ig-sheet textarea').value.trim();
      const asStory = screen.querySelector('.bp-ig-asstory input').checked;
      screen.querySelector('.bp-ig-sheet')?.remove();
      if (asStory) { d.stories.push({ id: uid(), author: meA(), img: pendingImg, desc: '', text: cap, ts: Date.now(), seen: true }); save(); say('限動發了'); renderFeed(); return; }
      const p = { id: uid(), author: meA(), img: pendingImg, desc: '妳的照片', caption: cap, likes: 0, ts: Date.now(), comments: null };
      d.posts.push(p); save(); openId = p.id; back = 'feed'; renderPost(); say('分享了，等等會有人來留言');
      setTimeout(() => { if (!p.comments) loadComments(p); }, 2500);
    }
    if (a === 'savecast' && castEdit) {
      const look = screen.querySelector('.bp-ig-look')?.value.trim() || '';
      setPerson(people, castEdit.name, { photo: castEdit.photo, look, hair: person(people, ch, castEdit.name).hair });
      castEdit = null; saveCast(); screen.querySelector('.bp-ig-sheet')?.remove(); rerender(); return;
    }
    if (a === 'castclear' && castEdit) { setPerson(people, castEdit.name, {}); castEdit = null; saveCast(); screen.querySelector('.bp-ig-sheet')?.remove(); rerender(); return; }
    if (a === 'auto') {
      try { localStorage.setItem(AUTO_KEY, autoOn() ? '0' : '1'); } catch { /* 存不了 */ }
      say(autoOn() ? '打開了：他之後發的貼文會自動生成照片' : '關掉了：貼文先用文字描述，點進去再生圖');
      renderFeed(); if (autoOn()) autoDraw(ch, d); return;
    }
    if (a === 'gen') {
      const p = find(openId); const btn = screen.querySelector('.bp-ig-gen'); if (btn) btn.textContent = '生圖中⋯';
      const url = await draw(p, ch, '1:1', true);
      if (url) { p.img = url; save(); } else say('沒有出圖：酒館可能還沒接生圖');
      if (mine() && view === 'post') renderPost();
    }
  });

  function postMenu(id) {
    const p = find(id); if (!p) return;
    screen.querySelector('.bp-ig-menu')?.remove();
    screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-menu"><div class="bp-ig-menu-bg" data-igm="close"></div><div class="bp-ig-menu-card">
      ${p.author.kind !== 'me' ? `<button data-igm="redo" data-id="${p.id}">重寫這篇</button>` : ''}
      <button data-igm="del" data-id="${p.id}" class="danger">刪除這篇</button>
      <button data-igm="close">取消</button></div></div>`);
  }

  // 寫歪的貼文重寫一次：發文的人是誰、做什麼的照角色卡和世界書，帳號不對就換掉（同一個帳號的其他貼文、限動、留言一起換）
  async function rewritePost(p) {
    const who = ch; const dd = d;
    say('重寫中⋯');
    try {
      const r = parseJSON(await generate([
        await worldRoster(),
        '[Brume Phone · Instagram]',
        `現在不是在寫劇情正文。重寫 Instagram 上的一篇貼文，原本是 @${p.author.handle}（${p.author.name}）發的：「${p.caption}」，照片：${p.desc}`,
        p.author.kind === 'him' ? `這篇是 ${who.name} 本人發的，照他的個性和最近發生的事重寫內容。` : `發文的人是誰、做什麼的、帳號叫什麼，照角色卡、世界書和正文；原本的身分或帳號跟資料不合就改掉。不要寫成 ${who.user} 發的。`,
        WORLD,
        `- photo 裡如果拍到 ${who.name} 或 ${who.user}，一定要寫出名字`,
        shotRules(people, who),
        '', '只輸出 JSON：{"type":"本人/配角/路人","name":"","handle":"英文小寫帳號","photo":"照片拍到什麼，一句話","shot":"","in":[],"caption":"說明文字"}',
      ].filter(Boolean).join('\n')));
      const old = p.author.handle;
      if (p.author.kind !== 'him') {
        const name = String(r.name || p.author.name); const handle = String(r.handle || old).replace(/^@/, '').slice(0, 24);
        const fix = (a) => { if (a && a.kind !== 'me' && a.kind !== 'him' && a.handle === old) { a.handle = handle; a.name = name; } };
        dd.posts.forEach((x) => { fix(x.author); (x.comments || []).forEach((c) => fix(c.author)); });
        dd.stories.forEach((x) => fix(x.author));
      }
      p.desc = String(r.photo || p.desc); p.caption = String(r.caption || p.caption);
      delete p.shot; delete p.in; Object.assign(p, shotOf(r));
      delete p.img; p.drawn = false; p.comments = null; // 照片描述換了，舊圖不對；留言也重來
      if (who.key === ch?.key) save();
      say('重寫好了');
      if (mine()) view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed();
      if (autoOn() && p.author.kind === 'him') autoDraw(who, dd);
    } catch (err) { say(`沒有重寫成功：${err.message || err}`); }
  }

  function showStory() {
    const s = story.list[story.i];
    screen.querySelector('.bp-ig-storyv')?.remove();
    screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-storyv">
      <div class="bp-ig-sbars">${story.list.map((_, i) => `<i class="${i < story.i ? 'done' : i === story.i ? 'now' : ''}"></i>`).join('')}</div>
      <header>${av(s.author, 'xs')}<b>${esc(s.author.handle)}</b><span>${ago(s.ts)}</span></header>
      ${s.img ? `<img src="${esc(s.img)}" alt="" data-igstory="${s.id}">` : `<div class="card" style="--h:${hue(s.desc)}" data-igstory="${s.id}"><span>${esc(s.desc)}</span>${s.author.kind !== 'me' ? '<small class="bp-ig-lphint">長按生成照片</small>' : ''}</div>`}
      ${s.text ? `<p>${esc(s.text)}</p>` : ''}<small>點一下看下一則</small></div>`);
  }

  screen.addEventListener('change', async (e) => {
    if (!mine() || !e.target.classList.contains('bp-ig-file')) return;
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (e.target.dataset.for === 'avatar') { d.me.avatar = await store.shrink(f, 300, 0.85); save(); renderProfile(); return; }
    if (castEdit && e.target.dataset.for === 'castpic') {
      // 768 寬：當大頭貼夠清楚，當生圖參考也看得清臉，又不會讓同步的檔案太大
      castEdit.photo = await store.shrink(f, 768, 0.85);
      const box = screen.querySelector('.bp-ig-sheet [data-ig="castpic"]'); if (box) box.innerHTML = `<img src="${castEdit.photo}" alt="">`;
      return;
    }
    const img = await store.shrink(f, 1080, 0.85);
    pendingImg = img;
    const pk = screen.querySelector('.bp-ig-pick'); if (pk) pk.innerHTML = `<img src="${img}" alt="">`;
  });

  screen.addEventListener('submit', (e) => {
    if (!mine()) return;
    e.preventDefault();
    const inp = screen.querySelector('.bp-ig-bar input'); const text = inp?.value.trim(); const p = find(openId);
    if (text && p) reply(p, text);
  });

  // 從相本請他發一篇：照片給他看（酒館能送圖的話），他寫說明文字，發在他的帳號
  async function postPhoto(img, hint, albumId) {
    const who = currentChar(); if (!who) return false;
    const dd = (await store.get('ig:' + who.key).catch(() => null)) || { me: { handle: '', bio: '' }, him: { handle: '', bio: '' }, posts: [], stories: [] };
    dd.me.handle ||= who.user; dd.him.handle ||= who.name;
    const see = canSeeImages();
    const raw = await generate([
        await worldRoster(),
      '[Brume Phone · Instagram]',
      `現在不是在寫劇情正文。${who.user} 把你們相本裡的一張照片給 ${who.name}，問他要不要發 IG。`,
      see ? '照片附在這則訊息裡，照實際看到的寫。' : (hint ? `照片內容：${hint}` : '（照片你看不到，寫得含蓄一點）'),
      hint && see ? `她對這張照片的說明：${hint}` : '',
      `用 ${who.name} 的個性寫這篇貼文的說明文字：他會怎麼曬、會不會標她、會不會害羞。可以很短。`,
      '只輸出 JSON：{"caption":"說明文字","likes":150}',
    ].filter(Boolean).join('\n'), see ? img : null);
    const r = parseJSON(raw);
    if (albumId) { dd.usedAlbum ||= []; dd.usedAlbum.push(albumId); }
    dd.posts.push({ id: uid(), author: { kind: 'him', name: who.name, handle: dd.him.handle }, desc: hint || '你們的合照', img, fromAlbum: true, caption: String(r.caption || ''), likes: +r.likes || 80 + Math.floor(Math.random() * 200), ts: Date.now(), comments: null });
    await store.set('ig:' + who.key, dd);
    if (ch?.key === who.key) d = dd;
    return String(r.caption || '');
  }

  // 有 shot 的照片長按改的是 shot（真正送去生圖的那段）；舊照片改 desc
  const setText = (x, text) => { if (x.shot) { x.shot = text; x.in = shotInAfterEdit(people, ch, text, x.in); } else x.desc = text; };

  // 長按貼文照片 → 改描述、重新出圖（妳自己發的、從相本來的是真照片，不能改）
  promptEditor(screen, {
    say,
    match: (el) => { if (!mine()) return null; const st = el.closest('[data-igstory]'); if (st) return 's:' + st.dataset.igstory; return el.closest('[data-igphoto]')?.dataset.igphoto ?? null; },
    get: (id) => {
      if (id.startsWith('s:')) { const s = d.stories.find((x) => x.id === id.slice(2)); return s && s.author.kind !== 'me' && s.desc ? { text: s.shot || s.desc, hasImg: !!s.img, img: s.img } : null; }
      const p = find(id); return p && p.author.kind !== 'me' && !p.fromAlbum ? { text: p.shot || p.desc, hasImg: !!p.img, img: p.img } : null;
    },
    run: async (id, text, again) => {
      // 限動：改描述、重新出直的（9:16）
      if (id.startsWith('s:')) {
        const s = d.stories.find((x) => x.id === id.slice(2)); if (!s) return;
        setText(s, text); save();
        if (again) { say('生圖中⋯'); const url = await draw(s, ch, '9:16', true); if (url) { s.img = url; save(); } }
        if (screen.querySelector('.bp-ig-storyv') && story.list[story.i] === s) showStory();
        return;
      }
      const p = find(id); if (!p) return;
      setText(p, text); save();
      if (!again) { say('描述存好了'); view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed(); return; }
      say('生圖中⋯');
      const url = await draw(p, ch, '1:1', true);
      if (url) { p.img = url; save(); }
      if (mine()) view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed();
    },
  });

  return { open() { view = 'feed'; render(); }, postPhoto };
}
