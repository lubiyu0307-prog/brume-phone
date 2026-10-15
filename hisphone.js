// 他的手機：趁他不注意偷拿來看。只能看、不能動。
// 每個 App 第一次打開時生一包存起來；隔六小時以上再打開，會多幾則新的，像真的手機一樣慢慢累積。
// 他的小動作藏在各處：妳的備註名、有沒有被釘選、打了沒傳的草稿、跟朋友聊到妳、藏起來的照片⋯

import * as store from './store.js';
import { currentChar, generate, imageInfo, canDraw } from './st.js';
import { HIM, ME, loadCast, refsFor, idsFor, finalPrompt, ensureAutoStyle } from './cast.js';
import { imagineAndPick } from './pick.js';
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
  let drawing = false;
  let ch = null; let hp = null; let view = 'lock'; let sub = null; let typed = ''; let fails = 0;
  const busy = new Set();

  const key = () => 'his:' + ch.key;
  const save = () => ch && store.set(key(), hp).catch(() => {});

  // 給模型看的背景：她跟他在 LINE 上最近聊的、他記得的事
  async function background() {
    const t = (await store.get('line:' + ch.key).catch(() => null)) || { msgs: [] };
    const mem = (await store.get('memory:' + ch.key).catch(() => null)) || [];
    const recent = t.msgs.filter((m) => !m.err && m.text).slice(-15).map((m) => `${m.me ? ch.user : ch.name}：${m.text}`).join('\n');
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
      bg ? `\n${bg}` : '',
      '',
      task,
      '',
      `只輸出 JSON，不要其他文字，格式：${format}`,
    ].filter((l) => l !== null).join('\n')));
  }

  // ---------- 各個 App 的內容生成（第一次生一包、之後慢慢長） ----------
  const GEN = {
    async setup() {
      const r = await ask(`他的手機密碼是四位數字，請想一個他會設的密碼（跟他在乎的事有關，例如某個日子），再寫一句只有 ${ch.user} 可能猜到的提示。`, '{"code":"四位數字","hint":"提示，15 字內"}');
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
      const r = await ask(grow
        ? `他的相簿過了一段時間，多了 2～4 張新照片。之前的照片有：${hp.album.slice(-6).map((p) => p.desc).join('／')}`
        : `他相簿裡最近的 12 張照片（用一句話描述照片拍到什麼）。其中 2～4 張是他放進「已隱藏」的，多半是他偷拍或捨不得刪的 ${ch.user}`,
        '[{"desc":"照片拍到什麼，一句話","hidden":false,"daysAgo":1}]');
      const now = Date.now();
      const add = (Array.isArray(r) ? r : []).map((p) => ({ desc: String(p.desc || ''), hidden: !!p.hidden, ts: now - Math.max(0, +p.daysAgo || 0) * 864e5 - Math.random() * 36e5 }));
      hp.album = grow ? [...hp.album, ...add] : add;
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
      const msgs = t.msgs.filter((m) => !m.err && (m.text || m.img || m.sticker));
      return `<div class="bp-hp-chat">${msgs.slice(-60).map((m) => bubble(!m.me, m.img ? '［照片］' : m.sticker ? `［貼圖］${m.sticker.tag}` : m.text, m.ts)).join('') || '<p class="bp-hp-loading">還沒聊過。</p>'}</div>
        ${hp.line.draft ? `<div class="bp-hp-draft"><small>他打了沒傳出去的：</small>${esc(hp.line.draft)}</div>` : ''}`;
    }
    const c = hp.line.chats.find((x) => x.name === id);
    if (!c) return '';
    return `<div class="bp-hp-chat">${c.msgs.map((m) => bubble(m.me, m.text, m.ts, m.me ? '' : m.from)).join('')}</div>`;
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
      ${hidden.length ? `<h4>已隱藏 <small>${hidden.length}</small></h4><div class="bp-hp-pgrid">${hidden.map((x) => photoTile(x.p, x.i)).join('')}</div>` : ''}`;
  }
  function albumOne(i) {
    const p = hp.album[i];
    // 一張一張自己決定要不要生成：點進去才有按鈕，不會整本一起畫
    return `${p.img ? `<img class="bp-hp-pimg" src="${esc(p.img)}" alt=""><p class="bp-hp-pdesc">${esc(p.desc)}</p>` : `<div class="bp-hp-pone" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span></div>`}
      <p class="bp-hp-meta">${new Date(p.ts).getMonth() + 1}月${new Date(p.ts).getDate()}日 ${when(p.ts)}${p.hidden ? '・已隱藏' : ''}</p>
      ${canDraw() ? `<div class="bp-hp-pacts"><button data-hp="gen" ${drawing ? 'disabled' : ''}>${drawing ? '生成中⋯' : p.img ? '重新生一張' : '生成這張照片'}</button>${p.img ? '<button data-hp="ungen">換回文字</button>' : ''}</div>` : ''}`;
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
    const ph = e.target.closest('[data-photo]'); if (ph) { sub = +ph.dataset.photo; paint(); return; }
    const mo = e.target.closest('[data-memo]'); if (mo) { sub = +mo.dataset.memo; paint(); return; }
    const a = e.target.closest('[data-hp]')?.dataset.hp;
    if (a === 'exit') { close(); onExit?.(); }
    if (a === 'home') { view = 'home'; sub = null; paint(); }
    if (a === 'sub') { sub = null; paint(); }
    if (a === 'peek') { say(`他輸的是 ${hp.code}`); }
    if (a === 'ungen' && hp.album[sub]) { delete hp.album[sub].img; save(); paint(); }
    if (a === 'gen' && hp.album[sub] && !drawing) {
      const i = sub; const p = hp.album[i]; const who = ch;
      drawing = true; paint();
      try {
        const people = await loadCast(who.charKey);
        await ensureAutoStyle(people, who.charKey);
        // 他手機裡的照片是他拍的；寫到自拍、鏡子、倒影他才入鏡，寫到她就帶她的證件照
        const always = [];
        if (/自拍|鏡子|鏡中|對鏡|合照|倒影|反射|映在/.test(p.desc)) always.push(HIM);
        if (new RegExp(`她|妳|${who.user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(p.desc)) always.push(ME);
        const ids = idsFor(people, p.desc, always);
        const prompt = finalPrompt(people, who, `${p.desc}, photo taken on his phone, candid, natural light`, ids, { by: HIM });
        const url = await imagineAndPick(host, prompt, { refs: refsFor(people, who, p.desc, always), aspect: '1:1' });
        if (url) { p.img = url; if (who.key === ch?.key) save(); }
        else say(imageInfo.why ? `沒有出圖：${imageInfo.why}` : '沒有出圖');
      } catch (err) { say(`沒有出圖：${err.message || err}`); }
      drawing = false; if (view === 'album' && sub === i) paint();
    }
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
