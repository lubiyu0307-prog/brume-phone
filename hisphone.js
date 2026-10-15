// 他的手機：趁他不注意偷拿來看。只能看、不能動。
// 每個 App 第一次打開時生一包存起來；隔六小時以上再打開，會多幾則新的，像真的手機一樣慢慢累積。
// 他的小動作藏在各處：妳的備註名、有沒有被釘選、打了沒傳的草稿、跟朋友聊到妳、藏起來的照片⋯

import * as store from './store.js';
import { currentChar, generate, imageInfo, canDraw, worldRoster, dropImage } from './st.js';
import { HIM, ME, loadCast, refsFor, idsFor, finalPrompt, ensureAutoStyle, shotRules, shotIds, shotInAfterEdit, isSavedImage, savedImagePrompt, shotHand } from './cast.js';
import { imagineAndPick } from './pick.js';
import { promptEditor } from './promptedit.js';
import { verify } from './music.js';
import * as stage from './stage.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const GROW_AFTER = 6 * 3600e3;
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function when(ts) {
  const d = new Date(ts); const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diff === 0) return t;
  if (diff === 1) return `昨天 ${t}`;
  if (diff < 7) return `星期${WEEK[d.getDay()]}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

// 模型回的 JSON 常常包在 ```json 裡或前後多講話，抓第一個 { 或 [ 開始的那一段
function parseJSON(raw) {
  const t = raw.replace(/```(?:json)?/gi, '');
  const i = t.search(/[[{]/);
  if (i < 0) throw new Error('沒有生出內容');
  const open = t[i]; const close = open === '{' ? '}' : ']';
  const j = t.lastIndexOf(close);
  return JSON.parse(t.slice(i, j + 1));
}

const IC = {
  line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 4C6.8 4 3 7.2 3 11.1c0 3.5 3 6.3 7 6.9l-.6 2.6c-.1.4.3.6.6.4 2.6-1.6 5.9-3.8 7.4-5.6 1.4-1.3 2.6-2.6 2.6-4.3C21 7.2 17.2 4 12 4z"/></svg>',
  album: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>',
  memo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
  safari: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  threads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M16.8 8.6C16 6 14.2 4.5 11.8 4.5 8 4.5 5.5 7.6 5.5 12s2.5 7.5 6.3 7.5c3 0 5.3-1.6 5.3-4.3 0-2.4-2-3.7-4.8-3.7-2.2 0-3.6 1-3.6 2.4 0 1.3 1.1 2.2 2.6 2.2 2.4 0 3.6-1.8 3.6-5"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3 21 9.5l-2 1-3.5-1-3 3 .5 4.5-1.5 1.5-3-3L4 20l-.5-.5 4.5-4.5-3-3L6.5 10.5 11 11l3-3-1-3.5z"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 9h3l4-4v14l-4-4H6z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};

const APPS = [
  { id: 'line', name: 'LINE', ic: 'line' },
  { id: 'album', name: '照片', ic: 'album' },
  { id: 'memos', name: '備忘錄', ic: 'memo' },
  { id: 'search', name: 'Safari', ic: 'safari' },
  { id: 'threads', name: 'Threads', ic: 'threads' },
  { id: 'music', name: '音樂', ic: 'music' },
];

export function createHisPhone({ host, say, onExit }) {
  let drawing = false; let rewriting = false;
  let ch = null; let hp = null; let view = 'lock'; let sub = null; let typed = ''; let fails = 0;
  let delArmed = null; // 刪照片要按兩次：第一次按的是哪一張
  const busy = new Set();

  const key = () => 'his:' + ch.key;
  const save = () => ch && store.set(key(), hp).catch(() => {});

  // 給模型看的背景：她跟他在 LINE 上最近聊的、他記得的事
  async function background() {
    const t = (await store.get('line:' + ch.key).catch(() => null)) || { msgs: [] };
    const mem = (await store.get('memory:' + ch.key).catch(() => null)) || [];
    // 現實時間聊的不算劇情裡發生的事（10/15 備忘錄寫了「她叫我阿愷」，那是現實時間傳的），除非她打開了「現實聊的也讓劇情知道」
    const recent = t.msgs.filter((m) => !m.err && m.text && (!m.now || t.nowSync)).slice(-15).map((m) => `${m.me ? ch.user : ch.name}：${m.text}`).join('\n');
    return [
      recent ? `他跟 ${ch.user} 最近在 LINE 上聊的：\n${recent}` : '',
      mem.length ? `他記得關於她的事：\n${mem.map((m) => '- ' + m.text).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
  }

  async function ask(task, format) {
    const bg = await background();
    // 隨時都能偷看（不用等交往），所以手機裡的東西要照現在的關係寫：剛認識就不會把她存成「老婆」
    const st = await stage.get(ch.key);
    return parseJSON(await generate([
      '[Brume Phone · 他的手機]',
      `現在不是在寫劇情正文。${ch.user} 趁 ${ch.name} 不注意，偷偷拿了他的手機在看。請照 ${ch.name} 的個性、生活、跟 ${ch.user} 的關係和最近發生的事，寫出他手機裡會有的東西。`,
      '- 要像真的手機：日常、瑣碎、有生活感，也藏著他不會當面說的事',
      `- 跟 ${ch.user} 有關的小地方要自然，不要每一樣都繞著她`,
      `- 他們現在的關係是「${stage.name(st)}」（${stage.tone(st)}）：備註名、聊天、相簿裡跟她有關的東西都要符合這個階段，不要超前`,
      '- 出現的其他人物要符合角色卡和世界觀，年代、用語也一樣',
      '- 配角的身分、職業、跟他的關係，照角色卡、世界書和正文裡寫的；資料裡沒寫的不要自己給他們新的職業或頭銜（例如不要把同事寫成醫生）',
      `- 他只知道劇情裡發生過、他親眼看到或 ${ch.user} 親口告訴他的事。${ch.user} 的設定裡還沒在劇情中讓他知道的（職業、家人、過去），他不知道，不能寫進手機；真的寫到也只能是他的猜測，可以猜錯`,
      bg ? `\n${bg}` : '',
      await worldRoster(),
      '',
      task,
      '',
      `只輸出 JSON，不要其他文字，格式：${format}`,
    ].filter((l) => l !== null).join('\n')));
  }

  // ---------- 各個 App 的內容生成（第一次生一包、之後慢慢長） ----------
  const GEN = {
    async setup() {
      // 密碼一定要是玩家看得到的資料裡出現過的數字：以前只說「她可能猜到」，模型會拿玩家根本不知道的日子當密碼（10/15）
      const r = await ask([
        `他的手機密碼是四位數字。請從角色卡、世界書或正文裡「已經寫出來」的數字挑一個他會拿來當密碼的：時間（例如 09:30 → 0930）、日期（例如 6 月 1 日 → 0601）、號碼、門牌、年份。`,
        `- 這個數字一定要是 ${ch.user} 讀過劇情或角色卡就找得到的，不能是資料裡沒寫、要靠猜的日子（生日、紀念日沒寫出來就不能用）`,
        '- 優先挑跟他在乎的事有關的，最好是正文裡出現過的',
        `- 提示要指向那個東西，但不要直接說出數字，15 字內（例如「早上第一場企鵝餵食秀的時間」）`,
        '- 真的找不到任何寫出來的數字，才自己想一個，提示要寫得很明白',
      ].join('\n'), '{"code":"四位數字","from":"這個數字出自哪裡，一句話","hint":"提示，15 字內"}');
      hp.code = String(r.code || '').replace(/\D/g, '').slice(0, 4).padStart(4, '0');
      hp.hint = String(r.hint || '');
    },
    async line(grow) {
      const now = Date.now();
      if (!grow) {
        const r = await ask(
          `寫他的 LINE：\n- 他給 ${ch.user} 取的備註名（不一定是本名，是他私下怎麼稱呼她）\n- 他有沒有把跟她的聊天釘選在最上面\n- 跟她的聊天框裡，他打了但沒有送出去的一句話（沒有就空字串）\n- 他跟其他人的 3～5 個聊天室（朋友、家人、工作、群組），每個 4～10 則，至少有一個聊天室裡他跟別人聊到她`,
          '{"remark":"","pinned":true,"draft":"","chats":[{"name":"聊天室名稱","type":"朋友","muted":false,"msgs":[{"from":"他 或 對方名字","text":"","hoursAgo":3}]}]}');
        hp.line = {
          remark: String(r.remark || ch.user), pinned: !!r.pinned, draft: String(r.draft || ''),
          chats: (r.chats || []).map((c) => ({ name: String(c.name || '聊天'), type: c.type || '', muted: !!c.muted, msgs: (c.msgs || []).map((m) => msg(m, now)) })),
        };
      } else {
        const have = hp.line.chats.map((c) => `${c.name}：${c.msgs.slice(-2).map((m) => m.text).join('／')}`).join('\n');
        const r = await ask(`他的 LINE 過了一段時間。現有聊天室的最後幾句：\n${have}\n請寫這段時間新多出來的訊息：挑 1～3 個聊天室各接 2～5 則（也可以開一個新的），可以順便更新他給 ${ch.user} 的備註名或草稿。`,
          '{"remark":"不改就空字串","draft":"不改就空字串","chats":[{"name":"","type":"","msgs":[{"from":"","text":"","hoursAgo":1}]}]}');
        if (r.remark) hp.line.remark = String(r.remark);
        if (typeof r.draft === 'string' && r.draft) hp.line.draft = r.draft;
        for (const c of r.chats || []) {
          const old = hp.line.chats.find((x) => x.name === c.name);
          const msgs = (c.msgs || []).map((m) => msg(m, now));
          if (old) old.msgs.push(...msgs); else hp.line.chats.push({ name: String(c.name || '聊天'), type: c.type || '', muted: false, msgs });
        }
      }
      function msg(m, base) {
        const me = /^他$|^我$/.test(String(m.from || '').trim()) || String(m.from || '').trim() === ch.name;
        return { me, from: String(m.from || ''), text: String(m.text || ''), ts: base - Math.max(0, +m.hoursAgo || 0) * 3600e3 };
      }
    },
    async album(grow) {
      const people = await loadCast(ch.charKey).catch(() => ({ cast: {}, look: {} }));
      const rules = `\n這些照片都是 ${ch.name} 用自己的手機拍或存下來的，拍照的人就是他。\n${shotRules(people, ch)}`;
      const r = await ask((grow
        // 以前只給最後 6 張、沒說不能重複，劇情停在同一幕時就一直重拍同一罐紅豆湯（10/15）
        ? `他的相簿過了一段時間，多了 2～4 張新照片。相簿裡已經有這些（[隱藏] 是已隱藏的）：\n${hp.album.slice(-30).map((p) => `- ${p.hidden ? '[隱藏] ' : ''}${String(p.desc).slice(0, 50)}`).join('\n')}\n新照片不能跟上面任何一張重複：不要再拍同一個東西、同一個地點的同一刻（同一罐飲料、同一隻動物、同一張長椅都算重複）。劇情裡已經拍過的那一幕不要再拍，寫這段時間他生活裡別的時刻，或劇情裡還沒拍過的新瞬間。`
        : `他相簿裡最近的 12 張照片（用一句話描述照片拍到什麼）。其中 2～4 張是他放進「已隱藏」的，多半是他偷拍或捨不得刪的 ${ch.user}`) + rules,
        '[{"desc":"照片拍到什麼，一句話","shot":"","in":[],"hidden":false,"daysAgo":1}]');
      const now = Date.now();
      const add = (Array.isArray(r) ? r : []).map((p) => ({ desc: String(p.desc || ''), ...(String(p.shot || '').trim() ? { shot: String(p.shot).trim(), in: Array.isArray(p.in) ? p.in.map(String) : [] } : {}), hidden: !!p.hidden, ts: now - Math.max(0, +p.daysAgo || 0) * 864e5 - Math.random() * 36e5 }));
      // 保險：跟已經有的描述太像的（兩字一組重疊四成以上）不收
      const fresh = grow ? add.filter((p) => !hp.album.some((o) => similar(o.desc, p.desc) >= 0.4)) : add;
      hp.album = grow ? [...hp.album, ...fresh] : add;
    },
    async memos(grow) {
      const r = await ask(grow
        ? `他的備忘錄過了一段時間，多了 1～2 則新的。之前的標題有：${hp.memos.map((m) => m.title).join('／')}`
        : `他備忘錄裡的 4～6 則筆記：待辦、隨手記、想做的事，也可能有一則是關於 ${ch.user} 的（他記下她說過的喜好、想帶她去的地方⋯）`,
        '[{"title":"","body":"可以多行，用 \\n 換行","daysAgo":2}]');
      const now = Date.now();
      const add = (Array.isArray(r) ? r : []).map((m) => ({ title: String(m.title || '無標題'), body: String(m.body || '').replace(/\\n/g, '\n'), ts: now - Math.max(0, +m.daysAgo || 0) * 864e5 }));
      hp.memos = grow ? [...hp.memos, ...add] : add;
    },
    async search(grow) {
      const r = await ask(grow
        ? `他的瀏覽器搜尋紀錄過了一段時間，多了 3～5 筆新的。之前的有：${hp.search.slice(-5).map((s) => s.q).join('／')}`
        : `他最近 10～12 筆搜尋紀錄。大部分是日常的，夾幾筆跟 ${ch.user} 有關、他不會讓她知道的`,
        '[{"q":"搜尋的字","hoursAgo":5}]');
      const now = Date.now();
      const add = (Array.isArray(r) ? r : []).map((s) => ({ q: String(s.q || ''), ts: now - Math.max(0, +s.hoursAgo || 0) * 3600e3 }));
      hp.search = grow ? [...hp.search, ...add] : add;
    },
    async threads(grow) {
      const r = await ask(grow
        ? '他的 Threads 草稿匣過了一段時間，多了 1 則沒發出去的草稿。'
        : `他 Threads 的草稿匣裡 2～3 則寫了沒發出去的文（為什麼沒發，看得出來）。再給他的 Threads 帳號名稱和一句簡介`,
        grow ? '[{"text":""}]' : '{"handle":"英文小寫帳號","bio":"","drafts":[{"text":""}]}');
      if (grow) hp.threads.drafts.push(...(Array.isArray(r) ? r : []).map((d) => ({ text: String(d.text || ''), ts: Date.now() })));
      else hp.threads = { handle: String(r.handle || ch.name), bio: String(r.bio || ''), drafts: (r.drafts || []).map((d) => ({ text: String(d.text || ''), ts: Date.now() - Math.random() * 5 * 864e5 })) };
    },
    async music(grow) {
      const r = await ask(grow
        ? `他最近又聽了 2～3 首新的歌。之前常聽的有：${hp.music.map((s) => s.title).join('／')}。只挑真的存在的歌，歌名歌手寫原文`
        : '他最近常聽的 8 首歌：照他的品味，只挑真的存在、串流上找得到的歌，歌名歌手寫原文。plays 是他這陣子聽了幾次',
        '[{"title":"","artist":"","plays":12}]');
      const found = (await Promise.all((Array.isArray(r) ? r : []).slice(0, 10).map(async (s) => {
        const v = await verify(String(s.title || ''), String(s.artist || '')).catch(() => null);
        return v ? { ...v, plays: +s.plays || 1 } : null;
      }))).filter(Boolean);
      hp.music = grow ? [...hp.music, ...found.filter((s) => !hp.music.some((x) => x.id === s.id))] : found;
    },
  };

  async function ensure(app) {
    const grow = !!hp[app] && Date.now() - (hp.gen?.[app] || 0) > GROW_AFTER;
    if (hp[app] && !grow) return;
    if (busy.has(app)) return;
    busy.add(app); paint();
    try {
      await GEN[app](grow);
      (hp.gen ||= {})[app] = Date.now();
      save();
    } catch (e) { say(`${grow ? '' : '打不開：'}${e.message || e}`); }
    busy.delete(app); paint();
  }

  // ---------- 畫面 ----------
  function paint() {
    if (!host.classList.contains('bp-show')) return;
    if (view === 'lock') return lockView();
    if (view === 'home') return homeView();
    return appView();
  }

  function status() {
    const n = new Date();
    return `<div class="bp-hp-status"><b>${pad(n.getHours())}:${pad(n.getMinutes())}</b><span data-hp="exit">${IC.swap} 還給他</span></div>`;
  }

  function lockView() {
    const n = new Date();
    host.innerHTML = `<div class="bp-hp bp-hp-lock">${status()}
      <div class="bp-hp-lockinfo"><small>${n.getMonth() + 1}月${n.getDate()}日 星期${WEEK[n.getDay()]}</small><b>${pad(n.getHours())}:${pad(n.getMinutes())}</b><span>${esc(ch.name)}的手機</span></div>
      ${!hp.code ? '<p class="bp-hp-hint">⋯⋯</p>' : `
      <p class="bp-hp-hint">輸入密碼${hp.hint ? `<br><em>提示：${esc(hp.hint)}</em>` : ''}</p>
      <div class="bp-hp-dots">${[0, 1, 2, 3].map((i) => `<i class="${i < typed.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="bp-hp-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => (k === '' ? '<span></span>' : `<span data-key="${k}">${k}</span>`)).join('')}</div>
      ${fails ? `<u data-hp="peek">${IC.eye} 我偷看到他輸密碼</u>` : ''}`}
    </div>`;
  }

  function homeView() {
    host.innerHTML = `<div class="bp-hp bp-hp-home">${status()}
      <div class="bp-hp-grid">${APPS.map((a) => `<div class="bp-hp-app" data-app="${a.id}"><i>${IC[a.ic]}</i><span>${a.name}</span></div>`).join('')}</div>
      <p class="bp-hp-foot">只能看，不能動。被發現就慘了。</p>
    </div>`;
  }

  function head(title, back = 'home') {
    return `${status()}<div class="bp-hp-head"><span class="bp-back" data-hp="${back}">‹</span><b>${esc(title)}</b><span></span></div>`;
  }
  const loading = (t) => `<p class="bp-hp-loading">${t}</p>`;

  async function appView() {
    const a = view;
    const wait = busy.has(a) && !hp[a];
    let body = '';
    if (wait) body = loading('翻找中⋯');
    else if (!hp[a]) body = loading('什麼都沒有。');
    else if (a === 'line') body = sub ? await lineChat(sub) : lineList();
    else if (a === 'album') body = sub !== null && sub !== undefined ? albumOne(sub) : albumGrid();
    else if (a === 'memos') body = sub !== null && sub !== undefined ? memoOne(sub) : memoList();
    else if (a === 'search') body = searchList();
    else if (a === 'threads') body = threadsView();
    else if (a === 'music') body = musicList();
    const title = { line: sub === 'her' ? hp.line?.remark : sub ? sub : 'LINE', album: '照片', memos: '備忘錄', search: '搜尋紀錄', threads: 'Threads', music: '最近播放' }[a];
    const back = (a === 'line' && sub) || ((a === 'album' || a === 'memos') && sub !== null && sub !== undefined) ? 'sub' : 'home';
    host.innerHTML = `<div class="bp-hp bp-hp-app-${a}">${head(title, back)}<div class="bp-hp-scroll">${body}${busy.has(a) && hp[a] ? loading('有新的東西進來了⋯') : ''}</div></div>`;
    if (a === 'line' && sub) { const s = host.querySelector('.bp-hp-scroll'); s.scrollTop = s.scrollHeight; }
  }

  function lineList() {
    const L = hp.line;
    const rows = [
      { id: 'her', name: L.remark, pinned: L.pinned, last: L.draft ? `［草稿］${L.draft}` : '⋯', ts: Date.now() - 6e5, draft: !!L.draft },
      ...L.chats.map((c) => ({ id: c.name, name: c.name, muted: c.muted, last: c.msgs[c.msgs.length - 1]?.text || '', ts: c.msgs[c.msgs.length - 1]?.ts || 0 })),
    ].sort((x, y) => (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0) || y.ts - x.ts);
    return rows.map((r) => `<div class="bp-hp-row" data-chat="${esc(r.id)}">
      <span class="bp-hp-av" style="--h:${hue(r.name)}">${esc(r.name.slice(0, 1))}</span>
      <div><b>${esc(r.name)}${r.pinned ? `<i class="bp-hp-pin">${IC.pin}</i>` : ''}${r.muted ? `<i class="bp-hp-mute">${IC.mute}</i>` : ''}</b>
        <span class="${r.draft ? 'draft' : ''}">${esc(r.last)}</span></div>
      <small>${r.id === 'her' ? '' : when(r.ts)}</small></div>`).join('');
  }

  async function lineChat(id) {
    if (id === 'her') {
      // 跟她的那串就是她手機上真的聊過的，只是從他這邊看
      const t = (await store.get('line:' + ch.key).catch(() => null)) || { msgs: [] };
      // 他的手機是劇情裡的東西：現實時間聊的不在這裡（除非她打開了讓劇情知道）
      const msgs = t.msgs.filter((m) => !m.err && (m.text || m.img || m.sticker) && (!m.now || t.nowSync));
      return `<div class="bp-hp-chat">${msgs.slice(-60).map((m) => bubble(!m.me, m.img ? '［照片］' : m.sticker ? `［貼圖］${m.sticker.tag}` : m.text, m.ts)).join('') || '<p class="bp-hp-loading">還沒聊過。</p>'}</div>
        ${hp.line.draft ? `<div class="bp-hp-draft"><small>他打了沒傳出去的：</small>${esc(hp.line.draft)}</div>` : ''}`;
    }
    const c = hp.line.chats.find((x) => x.name === id);
    if (!c) return '';
    return `<div class="bp-hp-chat">${c.msgs.map((m) => bubble(m.me, m.text, m.ts, m.me ? '' : m.from)).join('')}</div>
      <div class="bp-hp-pacts"><button data-hp="rechat" ${rewriting ? 'disabled' : ''}>${rewriting ? '重寫中⋯' : '重寫這個聊天室'}</button></div>`;
  }
  function bubble(mine, text, ts, from = '') {
    return `<div class="bp-hp-msg ${mine ? 'me' : 'them'}">${!mine && from ? `<small>${esc(from)}</small>` : ''}<div><p>${esc(text)}</p><em>${when(ts)}</em></div></div>`;
  }

  function photoTile(p, i) {
    return p.img
      ? `<div class="bp-hp-photo bp-has" data-photo="${i}"><img src="${esc(p.img)}" alt="" loading="lazy"></div>`
      : `<div class="bp-hp-photo" data-photo="${i}" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span></div>`;
  }
  function albumGrid() {
    const all = hp.album.map((p, i) => ({ p, i })).sort((a, b) => b.p.ts - a.p.ts);
    const shown = all.filter((x) => !x.p.hidden); const hidden = all.filter((x) => x.p.hidden);
    return `<div class="bp-hp-pgrid">${shown.map((x) => photoTile(x.p, x.i)).join('')}</div>
      ${hidden.length ? `<h4>已隱藏 <small>${hidden.length}</small></h4><div class="bp-hp-pgrid">${hidden.map((x) => photoTile(x.p, x.i)).join('')}</div>` : ''}
      ${hp.album.length ? `<div class="bp-hp-pacts"><button data-hp="realbum" ${rewriting ? 'disabled' : ''}>${rewriting ? '重寫中⋯' : '重寫全部照片描述'}</button></div>` : ''}`;
  }
  function albumOne(i) {
    const p = hp.album[i];
    // 一張一張自己決定要不要生成：點進去才有按鈕，不會整本一起畫
    return `${p.img ? `<img class="bp-hp-pimg" src="${esc(p.img)}" alt=""><p class="bp-hp-pdesc">${esc(p.desc)}</p>` : `<div class="bp-hp-pone" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span></div>`}
      <p class="bp-hp-meta">${new Date(p.ts).getMonth() + 1}月${new Date(p.ts).getDate()}日 ${when(p.ts)}${p.hidden ? '・已隱藏' : ''}</p>
      ${canDraw() ? `<div class="bp-hp-pacts"><button data-hp="gen" ${drawing ? 'disabled' : ''}>${drawing ? '生成中⋯' : p.img ? '重新生一張' : '生成這張照片'}</button>${p.img ? '<button data-hp="ungen">換回文字</button>' : ''}</div>` : ''}
      <div class="bp-hp-pacts"><button data-hp="pdel" class="bp-hp-danger">${delArmed === i ? '再按一次就刪掉' : '刪掉這張'}</button></div>`;
  }
  function memoList() {
    return hp.memos.map((m, i) => ({ m, i })).sort((a, b) => b.m.ts - a.m.ts).map(({ m, i }) => `<div class="bp-hp-memo" data-memo="${i}"><b>${esc(m.title)}</b><span>${when(m.ts)}　${esc(m.body.split('\n')[0]).slice(0, 30)}</span></div>`).join('');
  }
  function memoOne(i) {
    const m = hp.memos[i];
    return `<div class="bp-hp-memotext"><small>${new Date(m.ts).getMonth() + 1}月${new Date(m.ts).getDate()}日</small><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p></div>`;
  }
  function searchList() {
    return `<p class="bp-hp-sub">最近搜尋</p>${[...hp.search].sort((a, b) => b.ts - a.ts).map((s) => `<div class="bp-hp-q">${IC.safari}<span>${esc(s.q)}</span><small>${when(s.ts)}</small></div>`).join('')}`;
  }
  function threadsView() {
    const T = hp.threads;
    return `<div class="bp-hp-th"><b>${esc(ch.name)}</b><span>@${esc(T.handle)}</span><p>${esc(T.bio)}</p></div>
      <p class="bp-hp-sub">草稿 ${T.drafts.length}</p>
      ${T.drafts.map((d) => `<div class="bp-hp-draftpost"><p>${esc(d.text)}</p><small>沒有發佈・${when(d.ts)}</small></div>`).join('')}`;
  }
  function musicList() {
    return [...hp.music].sort((a, b) => b.plays - a.plays).map((s) => `<div class="bp-hp-song"><img src="${esc(s.cover)}" alt=""><div><b>${esc(s.title)}</b><span>${esc(s.artist)}</span></div><small>${s.plays} 次</small></div>`).join('') || loading('查不到他聽的歌。');
  }

  // ---------- 操作 ----------
  host.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-key]');
    if (k) {
      const v = k.dataset.key;
      if (v === '⌫') typed = typed.slice(0, -1); else if (typed.length < 4) typed += v;
      if (typed.length === 4) {
        if (typed === hp.code) { typed = ''; view = 'home'; paint(); return; }
        fails++; typed = ''; host.querySelector('.bp-hp-dots')?.classList.add('bp-shake');
        setTimeout(paint, 450); return;
      }
      paint(); return;
    }
    const app = e.target.closest('[data-app]');
    if (app) { view = app.dataset.app; sub = null; paint(); ensure(view); return; }
    const chat = e.target.closest('[data-chat]'); if (chat) { sub = chat.dataset.chat; paint(); return; }
    const ph = e.target.closest('[data-photo]'); if (ph) { sub = +ph.dataset.photo; delArmed = null; paint(); return; }
    const mo = e.target.closest('[data-memo]'); if (mo) { sub = +mo.dataset.memo; paint(); return; }
    const a = e.target.closest('[data-hp]')?.dataset.hp;
    if (a === 'exit') { close(); onExit?.(); }
    if (a === 'home') { view = 'home'; sub = null; paint(); }
    if (a === 'sub') { sub = null; paint(); }
    // 寫歪的聊天室（例如配角身分編錯）重寫一次：照角色卡、世界書，名稱不對可以順便改
    if (a === 'rechat' && view === 'line' && sub && sub !== 'her' && !rewriting) {
      const name = sub; const who = ch;
      rewriting = true; paint();
      try {
        const r = await ask(`重寫他跟「${name}」的這個 LINE 聊天室。這個人是誰、做什麼的、跟他什麼關係，照角色卡、世界書和正文；原本的名稱或身分如果跟資料不合就改掉（聊天室名稱就用他手機裡會存的名字）。寫 4～10 則。`,
          '{"name":"聊天室名稱","type":"朋友","msgs":[{"from":"他 或 對方名字","text":"","hoursAgo":3}]}');
        const now = Date.now();
        const c = hp.line.chats.find((x) => x.name === name);
        if (c && who.key === ch?.key) {
          c.name = String(r.name || name); c.type = r.type || c.type;
          c.msgs = (r.msgs || []).map((m) => ({ me: /^他$|^我$/.test(String(m.from || '').trim()) || String(m.from || '').trim() === who.name, from: String(m.from || ''), text: String(m.text || ''), ts: now - Math.max(0, +m.hoursAgo || 0) * 3600e3 }));
          save(); sub = c.name;
        }
      } catch (err) { say(`沒有重寫成功：${err.message || err}`); }
      rewriting = false; paint();
    }
    // 舊照片只有一句話描述，生圖得靠猜誰入鏡：整本重寫成新的寫法（desc＋shot＋in），同一張照片同一個瞬間，已經生好的圖留著
    if (a === 'realbum' && view === 'album' && !rewriting && hp.album.length) {
      const who = ch; const list = hp.album;
      rewriting = true; paint();
      try {
        const people = await loadCast(who.charKey).catch(() => ({ cast: {}, look: {} }));
        const r = await ask(`他相簿裡有這些照片，請一張一張重寫描述，拍的還是同一個瞬間、同一個東西，順序和張數都不變：\n${list.map((p, i) => `${i + 1}. ${p.desc}${p.hidden ? ' [這張在已隱藏]' : ''}`).join('\n')}\ndesc 只寫照片內容，不要寫「已隱藏」這類標記。\n這些照片都是 ${who.name} 用自己的手機拍或存下來的，拍照的人就是他。\n${shotRules(people, who)}`,
          '[{"n":1,"desc":"照片拍到什麼，一句話","shot":"","in":[]}]');
        let n = 0;
        for (const x of Array.isArray(r) ? r : []) {
          const p = list[(+x.n || 0) - 1]; if (!p || !String(x.shot || '').trim()) continue;
          p.desc = String(x.desc || p.desc).replace(/^[（(]已隱藏[）)]\s*|\s*\[這張在已隱藏\]/g, ''); p.shot = String(x.shot).trim(); p.in = Array.isArray(x.in) ? x.in.map(String) : []; n++;
        }
        if (who.key === ch?.key) save();
        say(n ? `重寫了 ${n} 張，已經生好的圖還在，想照新描述畫就點開按「重新生一張」` : '沒有重寫成功，再按一次試試');
      } catch (err) { say(`沒有重寫成功：${err.message || err}`); }
      rewriting = false; paint();
    }
    if (a === 'peek') { say(`他輸的是 ${hp.code}`); }
    // 刪照片：按一次變「再按一次就刪掉」，再按才刪（酒館裡不能跳確認視窗）
    if (a === 'pdel' && hp.album[sub]) {
      if (delArmed !== sub) { delArmed = sub; paint(); return; }
      const [gone] = hp.album.splice(sub, 1); delArmed = null; sub = null; save(); paint();
      if (gone?.img) dropImage(gone.img);
      say('刪掉了');
      return;
    }
    if (a !== 'pdel') delArmed = null;
    if (a === 'ungen' && hp.album[sub]) { delete hp.album[sub].img; save(); paint(); }
    if (a === 'gen' && hp.album[sub] && !drawing) await genPhoto(sub);
  });

  async function genPhoto(i) {
      const p = hp.album[i]; const who = ch; if (!p || drawing) return;
      drawing = true; paint();
      try {
        const people = await loadCast(who.charKey);
        await ensureAutoStyle(people, who.charKey);
        // 寫照片時一起寫好的畫面描述：照 shot 和 in 畫，不用猜
        if (p.shot && isSavedImage(p.shot)) {
          const url = await imagineAndPick(host, savedImagePrompt(p.shot), { refs: [], aspect: '1:1' });
          if (url) { p.img = url; if (who.key === ch?.key) save(); } else say(imageInfo.why ? `沒有出圖：${imageInfo.why}` : '沒有出圖');
          drawing = false; if (view === 'album' && sub === i) paint();
          return;
        }
        if (p.shot) {
          const ids = shotIds(people, who, p.in);
          const prompt = finalPrompt(people, who, p.shot, ids, ids.includes(HIM) ? {} : { by: HIM, hand: shotHand(p.shot) });
          const url = await imagineAndPick(host, prompt, { refs: refsFor(people, who, '', ids), aspect: '1:1' });
          if (url) { p.img = url; if (who.key === ch?.key) save(); } else say(imageInfo.why ? `沒有出圖：${imageInfo.why}` : '沒有出圖');
          drawing = false; if (view === 'album' && sub === i) paint();
          return;
        }
        // 下面是舊照片（沒有 shot）的猜法
        // 截圖、插畫、存下來的圖片不是他拍的照片：照那張圖本身畫，不放人、不放手、不帶證件照
        // （10/15「安羽傳過來的 LINE 大頭貼截圖」被畫成她本人＋一隻男生的手）
        // 「螢幕光映在臉上」是在講光，不是截圖（10/15 她的睡臉被當成截圖，畫成一支手機框、臉也沒帶證件照）
        const shot = /截圖|螢幕(?!光|的光|亮|映|照|藍光|微光)|截下|翻拍|插畫|插圖|貼圖|梗圖|海報|圖片|手繪|畫作|頭貼|桌布/.test(p.desc);
        const always = [];
        if (!shot) {
          // 他手機裡的照片是他拍的；寫到自拍、鏡子、倒影他才入鏡
          if (/自拍|鏡子|鏡中|對鏡|合照|倒影|反射|映在/.test(p.desc)) always.push(HIM);
          // 寫到她（她、妳、名字），或「已隱藏」裡寫到側影、背影、頭髮這些人的樣子，當成她入鏡
          // 名字後面接「傳、給、寄、說」是在講她做的事，不代表她在照片裡
          const nm = who.user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const herIn = new RegExp(`她|妳|${nm}(?![傳給寄說送])`).test(p.desc);
          if (herIn || (p.hidden && /側影|背影|身影|側臉|睡臉|長髮|捲髮|髮辮|鬆辮|馬尾|髮尾|頭髮/.test(p.desc))) always.push(ME);
        }
        const ids = shot ? [] : idsFor(people, p.desc, always);
        // 有寫到手才講是他的手；沒寫就不提，不然模型會硬塞一隻手進來
        // 「二手」「手寫」「手機」這些詞裡的手不算（10/15「二手唱片行⋯手寫標價籤」被塞了一隻手在翻唱片）
        const hand = /(?<!二)手(?![寫機工繪作冊帳錶套續術法邊])|手指|指尖|握著|托著|捧著|拿著/.test(p.desc);
        const prompt = shot
          ? `${p.desc}. Show only the saved image itself, flat, filling the whole frame edge to edge. No phone, no screen bezel, no people, no hands.`
          : finalPrompt(people, who, `${p.desc}, photo taken on his phone, candid`, ids, hand ? { by: HIM } : {});
        const url = await imagineAndPick(host, prompt, { refs: shot ? [] : refsFor(people, who, p.desc, always), aspect: '1:1' });
        if (url) { p.img = url; if (who.key === ch?.key) save(); }
        else say(imageInfo.why ? `沒有出圖：${imageInfo.why}` : '沒有出圖');
      } catch (err) { say(`沒有出圖：${err.message || err}`); }
      drawing = false; if (view === 'album' && sub === i) paint();
    }

  // 長按照片（格子或點開的大圖）→ 改描述、重新出圖
  promptEditor(host, {
    say,
    match: (el) => { const t = el.closest('[data-photo]'); if (t) return +t.dataset.photo; return view === 'album' && sub !== null && sub !== undefined && el.closest('.bp-hp-pimg, .bp-hp-pone') ? sub : null; },
    get: (i) => (hp?.album?.[i] ? { text: hp.album[i].shot || hp.album[i].desc, hasImg: !!hp.album[i].img, img: hp.album[i].img } : null),
    run: async (i, text, again) => {
      const p = hp.album[i]; if (!p) return;
      if (p.shot) { p.shot = text; p.in = shotInAfterEdit(await loadCast(ch.charKey), ch, text, p.in); } else p.desc = text;
      save();
      if (again) { view = 'album'; sub = i; await genPhoto(i); } else { say('描述存好了'); paint(); }
    },
  });

  function close() { host.classList.remove('bp-show'); host.innerHTML = ''; }

  return {
    async open() {
      ch = currentChar();
      if (!ch) { say('先在酒館選一個角色'); return false; }
      hp = (await store.get(key()).catch(() => null)) || {};
      view = 'lock'; sub = null; typed = ''; fails = 0;
      host.classList.add('bp-show'); paint();
      if (!hp.code) {
        try { await GEN.setup(); save(); } catch (e) { hp.code = '0000'; hp.hint = '他好像沒設什麼特別的'; say(`密碼沒生出來，先用 0000（${e.message || e}）`); }
        paint();
      }
      return true;
    },
    close,
    get active() { return host.classList.contains('bp-show'); },
  };
}

// 兩句描述有多像：兩個字一組切開，看重疊的比例（0～1）
function similar(a, b) {
  const grams = (t) => { const x = String(t).replace(/[\s，。、！？「」,.!?]/g, ''); const g = new Set(); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g; };
  const A = grams(a); const B = grams(b);
  if (!A.size || !B.size) return 0;
  let n = 0; for (const g of A) if (B.has(g)) n++;
  return n / Math.min(A.size, B.size);
}
