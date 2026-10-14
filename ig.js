// Instagram：妳的帳號在看。有他的貼文和限時動態，也有卡裡的配角、符合世界觀的路人。
// 妳可以發真的照片（他會看到照片本身來留言）、按愛心、留言（發文的人會回）、看他的個人頁。
// 他的照片先是文字描述，點進去可以叫酒館生圖。

import * as store from './store.js';
import { currentChar, generate, imagine, canSeeImages, ctx } from './st.js';

// 自動生圖：打開的話，他新發的貼文用酒館的生圖畫成真的照片（要接好生圖，一張要等一下）
const AUTO_KEY = 'brume-phone:igauto';
const autoOn = () => { try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; } };
const canImagine = () => !!ctx()?.executeSlashCommandsWithOptions;

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
const WORLD = '- 配角和路人的身分、語氣、話題都要符合這個故事的世界觀與年代';

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
  let ch = null; let d = null; let view = 'feed'; let openId = null; let profileOf = 'me'; let loading = false; let story = null; let back = 'feed';
  const mine = () => !!screen.querySelector('.bp-ig');
  const save = () => ch && store.set('ig:' + ch.key, d).catch(() => {});
  const find = (id) => d.posts.find((p) => p.id === id);
  const meA = () => ({ kind: 'me', name: ch.user, handle: d.me.handle });
  const himA = () => ({ kind: 'him', name: ch.name, handle: d.him.handle });

  function av(a, cls = '') {
    if (a.kind === 'him' && ch.avatar) return `<img class="bp-ig-av ${cls}" src="${ch.avatar}" alt="">`;
    if (a.kind === 'me' && d.me.avatar) return `<img class="bp-ig-av ${cls}" src="${d.me.avatar}" alt="">`;
    return `<span class="bp-ig-av ${cls}" style="--h:${hue(a.handle)}">${esc((a.name || '?').slice(0, 1))}</span>`;
  }
  const photo = (p, cls = '') => (p.img
    ? `<img class="bp-ig-img ${cls}" src="${esc(p.img)}" alt="">`
    : `<div class="bp-ig-img card ${cls}" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span></div>`);

  function post(p, detail) {
    const n = p.comments?.length || 0;
    return `<article class="bp-ig-post">
      <header data-prof="${p.author.kind}">${av(p.author, 'sm')}<b>${esc(p.author.handle)}</b><i>${IC.more}</i></header>
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
    if (view === 'post' && find(openId)) renderPost(); else if (view === 'profile') renderProfile(); else renderFeed();
    if (view === 'feed' && !d.posts.some((p) => p.author.kind !== 'me') && !loading) refresh();
  }

  function renderFeed() {
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

  function renderProfile() {
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
        ${!p.img && p.author.kind !== 'me' ? '<button class="bp-ig-gen" data-ig="gen">用酒館生出這張照片</button>' : ''}
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
        '[Brume Phone · Instagram]',
        `現在不是在寫劇情正文。${who.user} 在滑 Instagram。請寫動態上新的 4 篇貼文和 2 則限時動態：`,
        `- 貼文 1～2 篇是 ${who.name} 本人發的，照他的個性、生活和最近發生的事；其他是角色卡、世界書裡的配角或路人`,
        `- 限時動態至少 1 則是 ${who.name} 的，比貼文更隨性`,
        WORLD, `- 不要寫 ${who.user} 發的`,
        `- ${who.name} 的帳號用：${dd.him.handle === who.name ? '幫他取一個英文小寫帳號' : dd.him.handle}`,
        have ? `已經有的（不要重複）：\n${have}` : '',
        album.length ? `${who.name} 和 ${who.user} 相本裡的合照（${who.name} 想曬的話，可以拿其中一張發，在那篇加 "album":編號；不想就不用）：\n${album.map((p, i) => `${i + 1}. ${p.desc}`).join('\n')}` : '',
        '', '只輸出 JSON：{"posts":[{"type":"本人/配角/路人","name":"","handle":"英文小寫帳號","photo":"照片拍到什麼，一句話","caption":"說明文字","likes":120,"album":0}],"stories":[{"type":"","name":"","handle":"","photo":"畫面","text":"限動上的字"}]}',
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
        dd.posts.push({ id: uid(), author: a, desc: pic ? pic.desc : String(x.photo || ''), ...(pic ? { img: pic.img, fromAlbum: true } : {}), caption: String(x.caption || ''), likes: +x.likes || Math.floor(Math.random() * 200), ts: now - (i + Math.random()) * 3 * 36e5, comments: null });
      });
      (r.stories || []).forEach((x, i) => dd.stories.push({ id: uid(), author: author(x), desc: String(x.photo || ''), text: String(x.text || ''), ts: now - i * 2 * 36e5, seen: false }));
      dd.posts = dd.posts.slice(-80); dd.stories = dd.stories.filter((s) => now - s.ts < 864e5);
      if (who.key === ch?.key) save();
    } catch (e) { say(`動態更新失敗：${e.message || e}`); }
    loading = false;
    if (mine() && view === 'feed') renderFeed();
    autoDraw(who, dd);
  }

  // 照片的生圖 prompt：他的貼文帶上相本存的長相，每張的他才會像同一個人
  async function photoPrompt(p, who) {
    const look = p.author.kind === 'him' ? ((await store.get('look:' + who.charKey).catch(() => null)) || {}).him : '';
    return `${p.desc}${look && /他|自拍|本人|鏡/.test(p.desc) ? `, ${look}` : ''}, instagram photo, natural light`;
  }
  // 把他剛發、還是文字卡的貼文一張一張畫出來
  async function autoDraw(who, dd) {
    if (!autoOn() || !canImagine()) return;
    for (const p of dd.posts.filter((x) => x.author.kind === 'him' && !x.img && !x.drawn).slice(-2)) {
      p.drawn = true; // 失敗也不重試，免得每次重整都卡在同一張
      const url = await imagine(await photoPrompt(p, who));
      if (url) { p.img = url; if (who.key === ch?.key) { save(); if (mine() && view === 'feed') renderFeed(); } else store.set('ig:' + who.key, dd).catch(() => {}); }
    }
  }

  async function loadComments(p) {
    p.loading = true; p.comments = []; renderPost();
    const who = ch;
    try {
      const r = parseJSON(await generate([
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
    const lk = e.target.closest('[data-like]');
    if (lk) { const p = find(lk.dataset.like); p.liked = !p.liked; save(); view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed(); return; }
    const pr = e.target.closest('[data-prof]');
    if (pr && pr.dataset.prof !== 'other') { back = view; profileOf = pr.dataset.prof; renderProfile(); return; }
    const op = e.target.closest('[data-post]');
    if (op && view !== 'post') { back = view; openId = op.dataset.post; renderPost(); const p = find(openId); if (!p.comments) loadComments(p); return; }
    const st = e.target.closest('[data-story]');
    if (st) { const list = d.stories.filter((s) => s.author.handle === st.dataset.story && Date.now() - s.ts < 864e5); story = { list, i: 0 }; showStory(); return; }
    if (e.target.closest('.bp-ig-storyv')) { story.list[story.i].seen = true; story.i++; save(); if (story.i >= story.list.length) { screen.querySelector('.bp-ig-storyv')?.remove(); renderFeed(); } else showStory(); return; }
    const a = e.target.closest('[data-ig]')?.dataset.ig;
    if (!a) return;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'feed') renderFeed();
    if (a === 'back') { back === 'profile' && view === 'post' ? renderProfile() : renderFeed(); }
    if (a === 'refresh') refresh();
    if (a === 'profme') { profileOf = 'me'; renderProfile(); }
    if (a === 'compose') { pendingImg = null; composer(); }
    if (a === 'unsheet') screen.querySelector('.bp-ig-sheet')?.remove();
    if (a === 'pick' || a === 'avatar') { const f = screen.querySelector('.bp-ig-sheet .bp-ig-file') || screen.querySelector('.bp-ig-file'); f.dataset.for = a; f.click(); }
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
    if (a === 'auto') {
      try { localStorage.setItem(AUTO_KEY, autoOn() ? '0' : '1'); } catch { /* 存不了 */ }
      say(autoOn() ? '打開了：他之後發的貼文會自動生成照片' : '關掉了：貼文先用文字描述，點進去再生圖');
      renderFeed(); if (autoOn()) autoDraw(ch, d); return;
    }
    if (a === 'gen') {
      const p = find(openId); const btn = screen.querySelector('.bp-ig-gen'); if (btn) btn.textContent = '生圖中⋯';
      const url = await imagine(await photoPrompt(p, ch));
      if (url) { p.img = url; save(); } else say('沒有出圖：酒館可能還沒接生圖');
      if (mine() && view === 'post') renderPost();
    }
  });

  function showStory() {
    const s = story.list[story.i];
    screen.querySelector('.bp-ig-storyv')?.remove();
    screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-storyv">
      <div class="bp-ig-sbars">${story.list.map((_, i) => `<i class="${i < story.i ? 'done' : i === story.i ? 'now' : ''}"></i>`).join('')}</div>
      <header>${av(s.author, 'xs')}<b>${esc(s.author.handle)}</b><span>${ago(s.ts)}</span></header>
      ${s.img ? `<img src="${esc(s.img)}" alt="">` : `<div class="card" style="--h:${hue(s.desc)}"><span>${esc(s.desc)}</span></div>`}
      ${s.text ? `<p>${esc(s.text)}</p>` : ''}<small>點一下看下一則</small></div>`);
  }

  screen.addEventListener('change', async (e) => {
    if (!mine() || !e.target.classList.contains('bp-ig-file')) return;
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const img = await store.shrink(f, 1080, 0.85);
    if (e.target.dataset.for === 'avatar') { d.me.avatar = await store.shrink(f, 300, 0.85); save(); renderProfile(); return; }
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

  return { open() { view = 'feed'; render(); }, postPhoto };
}
