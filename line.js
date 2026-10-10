// LINE：跟現在酒館開著的角色傳訊息。
// 回覆走酒館自己的 generateQuietPrompt，所以模型看得到角色卡、世界書與正文。

import * as store from './store.js';

const OLD_STORE = 'brume-phone:line:'; // v0.2.0 存在 localStorage，第一次打開時搬進 IndexedDB

const ctx = () => window.SillyTavern?.getContext?.();
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pad = (n) => String(n).padStart(2, '0');
const hm = (ts) => { const d = new Date(ts); return `${d.getHours() < 12 ? '上午' : '下午'} ${(d.getHours() % 12) || 12}:${pad(d.getMinutes())}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const REACTS = { heart: '❤️', lol: '😂', tear: '🥲', wow: '😮', hug: '🤗', huh: '😤' };

const IC = {
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  regen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  resend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 12 20 4l-6 16-3-7z"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>',
};

/** 現在開著的角色；沒選角色或在群組聊天時回 null */
function currentChar() {
  const c = ctx();
  if (!c || c.groupId || c.characterId === undefined || c.characterId === null) return null;
  const ch = c.characters?.[c.characterId];
  if (!ch) return null;
  return {
    key: ch.avatar || ch.name,
    name: ch.name,
    avatar: ch.avatar ? `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}` : '',
    user: c.name1 || '我',
  };
}

async function loadThread(key) {
  let t = await store.get('line:' + key).catch(() => null);
  if (!t) {
    try { t = JSON.parse(localStorage.getItem(OLD_STORE + key)); } catch { t = null; }
    t = t || { msgs: [] };
    for (const m of t.msgs) m.id ||= uid();
    await store.set('line:' + key, t).catch(() => {});
    try { localStorage.removeItem(OLD_STORE + key); } catch { /* 沒有就算了 */ }
  }
  return t;
}
const saveThread = (key, t) => store.set('line:' + key, t).catch(() => {});

// 她的訊息從最新往回數：0、1、2⋯（表符與引用都用這個位置）
function herPositions(msgs) {
  const pos = new Map(); let n = 0;
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].me) pos.set(msgs[i].id, n++);
  return pos;
}

function msgText(m) {
  return m.img ? `［照片］${m.text ? ' ' + m.text : ''}` : m.text;
}

function buildPrompt(ch, msgs) {
  const now = new Date();
  const when = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（週${WEEK[now.getDay()]}）${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const pos = herPositions(msgs);
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const log = msgs.filter((m) => !m.err).slice(-40).map((m) => {
    const q = m.quote && byId.get(m.quote);
    const quoted = q ? `（回覆「${msgText(q).slice(0, 40)}」）` : '';
    const react = m.me ? (m.hisReact ? `（你按了 ${REACTS[m.hisReact]}）` : '') : (m.myReact ? `（她按了 ${REACTS[m.myReact]}）` : '');
    return m.me
      ? `${ch.user}［${pos.get(m.id)}］：${quoted}${msgText(m)}${react}`
      : `${ch.name}：${quoted}${msgText(m)}${react}`;
  }).join('\n');
  return [
    '[Brume Phone · LINE]',
    `現在不是在寫劇情正文。${ch.name} 正在用手機的 LINE 跟 ${ch.user} 傳訊息。`,
    `現在時間：${when}（現實時間）`,
    '',
    `最近的 LINE 對話（舊→新；${ch.user} 名字後面的［數字］是她那則訊息的位置，0 是最新的）：`,
    log || '（還沒有對話）',
    '',
    `請以 ${ch.name} 的身分回 LINE：`,
    '- 只寫他會傳出去的訊息文字，不寫動作、旁白、心理描寫',
    '- 像真人傳訊息：短句，一則一行，1～4 則',
    '- 不要加名字、引號、時間',
    '- 用跟對話一樣的語言',
    '',
    '想做的話可以加這些小動作（不用每次都做）：',
    '- 引用她的某一句來回：在回覆最前面獨立一行寫 [[QUOTE|位置]]',
    '- 對她的某則訊息回貼表符：在回覆最後獨立一行寫 [[REACT|位置|表符]]，表符只能是 heart、lol、tear、wow、hug、huh 其中一個，一次最多一個',
  ].join('\n');
}

async function generate(prompt, image) {
  const c = ctx();
  const fn = c?.generateQuietPrompt;
  if (!fn) throw new Error('找不到酒館的生成功能');
  // 新版酒館吃物件參數，舊版吃一串位置參數
  const objectStyle = /^\s*(async\s+)?(function\s*\w*\s*)?\(\s*\{/.test(String(fn));
  const out = objectStyle
    ? await fn.call(c, { quietPrompt: prompt, skipWIAN: false, removeReasoning: true, ...(image ? { quietImage: image } : {}) })
    : await fn.call(c, prompt, false, false, image || null);
  return String(out || '');
}

function parseReply(raw, ch) {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  let quote = null; let react = null;
  text = text.replace(/\[\[QUOTE\|(\d+)\]\]/i, (_, p) => { quote = +p; return ''; });
  text = text.replace(/\[\[REACT\|(\d+)\|(\w+)\]\]/i, (_, p, id) => { if (REACTS[id]) react = { pos: +p, id }; return ''; });
  text = text.replace(/\[\[[^\]]*\]\]/g, '');
  const namePrefix = new RegExp(`^(${reEsc(ch.name)}|${reEsc(ch.user)})\\s*[:：]\\s*`);
  const lines = text
    .split('\n')
    .map((l) => l.trim().replace(namePrefix, '').replace(/^[「『"]+|[」』"]+$/g, '').trim())
    .filter((l) => l && !/^[-*_]{3,}$/.test(l))
    .slice(0, 6);
  return { lines, quote, react };
}

export function createLine({ screen, say, onUnread }) {
  let ch = null;
  let thread = null;
  let bg = null;
  let view = 'list';
  let busy = false;
  let timer = null;
  let quoting = null;
  let renderToken = 0;

  const save = () => ch && saveThread(ch.key, thread);
  const find = (id) => thread.msgs.find((m) => m.id === id);

  function unreadCount() {
    if (!thread) return 0;
    return thread.msgs.filter((m) => !m.me && !m.err && m.ts > (thread.seen || 0)).length;
  }

  async function render() {
    const token = ++renderToken;
    ch = currentChar();
    if (!ch) {
      screen.innerHTML = `<div class="bp-line"><div class="bp-line-head"><span class="bp-back" data-line="home">‹</span><b>聊天</b><span></span></div>
        <div class="bp-line-empty">先在酒館選一個角色，<br>他的 LINE 就會出現在這裡。</div></div>`;
      return;
    }
    const [t, b] = await Promise.all([loadThread(ch.key), store.get('linebg:' + ch.key).catch(() => null)]);
    if (token !== renderToken) return;
    thread = t; bg = b;
    if (view === 'list') renderList(); else renderRoom();
  }

  function avatar(cls = '') {
    return ch.avatar
      ? `<img class="bp-line-av ${cls}" src="${ch.avatar}" alt="">`
      : `<span class="bp-line-av ${cls} bp-line-av-txt">${esc(ch.name.slice(0, 1))}</span>`;
  }

  function renderList() {
    const last = [...thread.msgs].reverse().find((m) => !m.err);
    const n = unreadCount();
    screen.innerHTML = `<div class="bp-line">
      <div class="bp-line-head"><span class="bp-back" data-line="home">‹</span><b>聊天</b><span></span></div>
      <div class="bp-line-row" data-line="room">
        ${avatar()}
        <div class="bp-line-row-mid"><div class="bp-line-row-name">${esc(ch.name)}</div>
          <div class="bp-line-row-last">${last ? esc(last.img && !last.text ? (last.me ? '妳傳了一張照片' : '傳了一張照片') : last.text) : '傳個訊息給他吧'}</div></div>
        <div class="bp-line-row-end"><div class="bp-line-row-time">${last ? hm(last.ts) : ''}</div>
          ${n ? `<span class="bp-line-badge">${n}</span>` : ''}</div>
      </div></div>`;
  }

  function quoteBox(m) {
    const q = m.quote && find(m.quote);
    if (!q) return '';
    return `<div class="bp-line-qbox" data-jump="${q.id}"><b>${q.me ? esc(ch.user) : esc(ch.name)}</b>${esc(q.img && !q.text ? '照片' : q.text).slice(0, 60)}</div>`;
  }

  function bubble(m) {
    const react = m.me ? m.hisReact : m.myReact;
    const body = m.img
      ? `<img class="bp-line-img" src="${m.img}" alt="">${m.text ? `<div class="bp-line-bub">${esc(m.text)}</div>` : ''}`
      : `<div class="bp-line-bub">${quoteBox(m)}${esc(m.text)}</div>`;
    return `<div class="bp-line-bwrap" data-id="${m.id}">${body}${react ? `<span class="bp-line-react">${REACTS[react]}</span>` : ''}</div>`;
  }

  function bubbles() {
    let out = ''; let lastDay = '';
    const readUpTo = thread.readTs || 0;
    let prevHim = false;
    for (const m of thread.msgs) {
      const d = new Date(m.ts); const day = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
      if (day !== lastDay) { out += `<div class="bp-line-day"><span>${day}</span></div>`; lastDay = day; prevHim = false; }
      const prev = prevHim; prevHim = !m.me && !m.err;
      if (m.me) {
        out += `<div class="bp-line-msg bp-me"><div class="bp-line-meta">${m.ts <= readUpTo ? '已讀<br>' : ''}${hm(m.ts)}</div>${bubble(m)}</div>`;
      } else if (m.err) {
        out += `<div class="bp-line-sys">${esc(m.text)}　<u data-line="retry">再試一次</u></div>`;
      } else {
        // 跟 LINE 一樣：連續好幾則只有第一則有頭像
        out += `<div class="bp-line-msg bp-him${prev ? ' bp-cont' : ''}">${prev ? '<span class="bp-line-av sm bp-ghost"></span>' : avatar('sm')}${bubble(m)}<div class="bp-line-meta">${hm(m.ts)}</div></div>`;
      }
    }
    if (busy === 'typing') out += `<div class="bp-line-msg bp-him">${prevHim ? '<span class="bp-line-av sm bp-ghost"></span>' : avatar('sm')}<div class="bp-line-bub bp-typing"><i></i><i></i><i></i></div></div>`;
    return out;
  }

  function renderRoom() {
    thread.seen = Date.now(); save(); onUnread?.(0);
    screen.innerHTML = `<div class="bp-line bp-line-roomv">
      <div class="bp-line-head"><span class="bp-back" data-line="list">‹</span><b>${esc(ch.name)}</b>
        <span class="bp-line-tools"><i data-line="search">${IC.search}</i><i data-line="more">${IC.more}</i></span></div>
      <div class="bp-line-body"${bg ? ` style="background-image:url('${bg}')"` : ''}>
        <div class="bp-line-log">${bubbles()}</div>
      </div>
      <div class="bp-line-quoting" hidden></div>
      <form class="bp-line-bar">
        <i class="bp-line-plus" data-line="photo">${IC.photo}</i>
        <input class="bp-line-input" placeholder="輸入訊息" enterkeyhint="send" autocomplete="off">
        <button type="submit" aria-label="傳送">➤</button></form>
      <input class="bp-line-file" type="file" accept="image/*" hidden>
      <div class="bp-line-pop"></div></div>`;
    showQuoting();
    const log = screen.querySelector('.bp-line-log'); log.scrollTop = log.scrollHeight;
  }

  function refreshLog() {
    const log = screen.querySelector('.bp-line-log');
    if (!log) return;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    log.innerHTML = bubbles();
    if (atBottom || busy) log.scrollTop = log.scrollHeight;
  }

  function showQuoting() {
    const box = screen.querySelector('.bp-line-quoting');
    if (!box) return;
    const q = quoting && find(quoting);
    box.hidden = !q;
    box.innerHTML = q ? `<div><b>回覆 ${q.me ? esc(ch.user) : esc(ch.name)}</b>${esc(q.img && !q.text ? '照片' : q.text).slice(0, 50)}</div><span data-line="unquote">✕</span>` : '';
  }

  // ---------- 浮出來的小面板（長按選單、編輯、更多、搜尋） ----------
  function pop(html, cls = '') {
    const p = screen.querySelector('.bp-line-pop');
    p.className = `bp-line-pop bp-show ${cls}`;
    p.innerHTML = `<div class="bp-line-pop-bg" data-line="unpop"></div><div class="bp-line-pop-card">${html}</div>`;
    return p.querySelector('.bp-line-pop-card');
  }
  const unpop = () => { const p = screen.querySelector('.bp-line-pop'); if (p) { p.className = 'bp-line-pop'; p.innerHTML = ''; } };

  function trailingHim() {
    const out = [];
    for (let i = thread.msgs.length - 1; i >= 0 && !thread.msgs[i].me; i--) if (!thread.msgs[i].err) out.push(thread.msgs[i].id);
    return out;
  }

  function msgMenu(id) {
    const m = find(id);
    if (!m || busy) return;
    const canRegen = !m.me && trailingHim().includes(id);
    const btn = (act, ic, label) => `<button data-mact="${act}" data-id="${id}">${IC[ic]}<span>${label}</span></button>`;
    pop(`${m.me ? '' : `<div class="bp-line-reacts">${Object.entries(REACTS).map(([k, e]) => `<span data-react="${k}" data-id="${id}" class="${m.myReact === k ? 'on' : ''}">${e}</span>`).join('')}</div>`}
      <div class="bp-line-acts">
        ${btn('quote', 'quote', '引用')}
        ${m.text ? btn('copy', 'copy', '複製') : ''}
        ${m.text ? btn('edit', 'edit', '編輯') : ''}
        ${canRegen ? btn('regen', 'regen', '重新生成') : ''}
        ${m.me && m.text ? btn('resend', 'resend', '改了再傳') : ''}
        ${btn('del', 'del', '刪除')}
      </div>`, 'bp-sheet-mode');
  }

  function editSheet(id, resend) {
    const m = find(id);
    const card = pop(`<div class="bp-line-edit"><b>${resend ? '改了再傳' : '編輯'}</b>
      <textarea rows="4">${esc(m.text)}</textarea>
      ${resend ? '<p>這則之後的對話會拿掉，他會照改過的重新回。</p>' : ''}
      <div class="bp-line-edit-btns"><button data-line="unpop">取消</button><button class="ok" data-line="${resend ? 'doresend' : 'doedit'}" data-id="${id}">${resend ? '傳送' : '儲存'}</button></div></div>`, 'bp-center-mode');
    const ta = card.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function moreMenu() {
    pop(`<div class="bp-line-list">
      <button data-line="search">搜尋對話</button>
      <button data-line="bg">換聊天背景</button>
      ${bg ? '<button data-line="bgreset">拿掉聊天背景</button>' : ''}
      <button data-line="clear" class="danger">清除這段對話</button>
      <button data-line="unpop" class="muted">取消</button></div>`, 'bp-sheet-mode');
  }

  function searchPanel() {
    const card = pop(`<div class="bp-line-search"><input placeholder="搜尋對話" enterkeyhint="search"><div class="bp-line-results"></div></div>`, 'bp-top-mode');
    const inp = card.querySelector('input'); const res = card.querySelector('.bp-line-results');
    inp.focus();
    inp.addEventListener('input', () => {
      const k = inp.value.trim();
      if (!k) { res.innerHTML = ''; return; }
      const hits = thread.msgs.filter((m) => !m.err && m.text && m.text.includes(k)).reverse().slice(0, 50);
      res.innerHTML = hits.length
        ? hits.map((m) => `<div data-jump="${m.id}"><b>${m.me ? esc(ch.user) : esc(ch.name)}</b><span>${esc(m.text).replaceAll(esc(k), `<mark>${esc(k)}</mark>`)}</span><i>${new Date(m.ts).getMonth() + 1}/${new Date(m.ts).getDate()}</i></div>`).join('')
        : '<p>找不到</p>';
    });
  }

  function jump(id) {
    unpop();
    const el = screen.querySelector(`.bp-line-bwrap[data-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('bp-flash'); setTimeout(() => el.classList.remove('bp-flash'), 1600);
  }

  // ---------- 送出、回覆 ----------
  function send(msg) {
    thread.msgs = thread.msgs.filter((m) => !m.err);
    thread.msgs.push({ id: uid(), me: true, ts: Date.now(), ...msg, ...(quoting ? { quote: quoting } : {}) });
    quoting = null; showQuoting();
    save(); refreshLog();
    scheduleReply();
  }

  // 妳停手 1.5 秒後他才開始回，連傳好幾則會一起看
  function scheduleReply() {
    clearTimeout(timer);
    timer = setTimeout(reply, 1500);
  }

  async function reply() {
    if (busy || !ch) return;
    const who = ch; const t = thread;
    const pending = t.msgs.length && t.msgs[t.msgs.length - 1].me;
    if (!pending) return;
    busy = 'read';
    await sleep(500 + Math.random() * 900);
    t.readTs = Date.now(); saveThread(who.key, t); if (view === 'room') refreshLog();
    busy = 'typing'; if (view === 'room') refreshLog();
    let out;
    try {
      t.msgs = t.msgs.filter((m) => !m.err);
      // 這一輪她傳的最後一張照片給模型看（酒館一次只吃一張圖）
      let image = null;
      for (let i = t.msgs.length - 1; i >= 0 && t.msgs[i].me; i--) if (t.msgs[i].img) { image = t.msgs[i].img; break; }
      out = parseReply(await generate(buildPrompt(who, t.msgs), image), who);
      if (!out.lines.length) throw new Error('他沒有回出字來');
    } catch (e) {
      busy = false;
      t.msgs.push({ id: uid(), me: false, err: true, text: `沒有回覆（${e.message || e}）`, ts: Date.now() });
      saveThread(who.key, t); if (view === 'room') refreshLog();
      return;
    }
    const pos = herPositions(t.msgs);
    const atPos = (p) => t.msgs.find((m) => m.me && pos.get(m.id) === p);
    if (out.react) { const target = atPos(out.react.pos); if (target) target.hisReact = out.react.id; }
    const quoteTarget = out.quote !== null ? atPos(out.quote) : null;
    for (let i = 0; i < out.lines.length; i++) {
      if (i) { busy = 'typing'; if (view === 'room') refreshLog(); await sleep(700 + Math.min(out.lines[i].length * 60, 1600)); }
      t.msgs.push({ id: uid(), me: false, text: out.lines[i], ts: Date.now(), ...(i === 0 && quoteTarget ? { quote: quoteTarget.id } : {}) });
      busy = i < out.lines.length - 1 ? 'typing' : false;
      saveThread(who.key, t);
      if (view === 'room' && currentChar()?.key === who.key) { t.seen = Date.now(); refreshLog(); }
      else onUnread?.(unreadCount());
    }
    busy = false;
    if (view === 'room') refreshLog();
    // 回覆期間她又傳了新的，就再回一輪
    if (t.msgs[t.msgs.length - 1]?.me) scheduleReply();
  }

  // ---------- 長按 ----------
  let pressTimer = null; let pressed = false;
  screen.addEventListener('pointerdown', (e) => {
    const w = e.target.closest('.bp-line-bwrap');
    if (!w) return;
    pressed = false;
    pressTimer = setTimeout(() => { pressed = true; msgMenu(w.dataset.id); }, 450);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  screen.addEventListener('pointerup', cancelPress);
  screen.addEventListener('pointercancel', cancelPress);
  screen.addEventListener('pointermove', (e) => { if (Math.abs(e.movementY) > 3) cancelPress(); });
  screen.addEventListener('contextmenu', (e) => {
    const w = e.target.closest('.bp-line-bwrap');
    if (!w) return;
    e.preventDefault(); cancelPress(); msgMenu(w.dataset.id);
  });

  // ---------- 點擊 ----------
  screen.addEventListener('click', async (e) => {
    if (pressed) { pressed = false; return; }
    const react = e.target.closest('[data-react]');
    if (react) {
      const m = find(react.dataset.id);
      m.myReact = m.myReact === react.dataset.react ? undefined : react.dataset.react;
      save(); unpop(); refreshLog(); return;
    }
    const mact = e.target.closest('[data-mact]');
    if (mact) {
      const id = mact.dataset.id; const m = find(id); const a = mact.dataset.mact;
      if (a === 'quote') { quoting = id; unpop(); showQuoting(); screen.querySelector('.bp-line-input')?.focus(); }
      if (a === 'copy') { unpop(); try { await navigator.clipboard.writeText(m.text); say('複製了'); } catch { say('這裡不能複製'); } }
      if (a === 'edit') editSheet(id, false);
      if (a === 'resend') editSheet(id, true);
      if (a === 'regen') {
        unpop();
        const drop = new Set(trailingHim());
        thread.msgs = thread.msgs.filter((x) => !drop.has(x.id) && !x.err);
        save(); refreshLog(); reply();
      }
      if (a === 'del') { thread.msgs = thread.msgs.filter((x) => x.id !== id); save(); unpop(); refreshLog(); }
      return;
    }
    const jumpTo = e.target.closest('[data-jump]');
    if (jumpTo) { jump(jumpTo.dataset.jump); return; }
    const a = e.target.closest('[data-line]')?.dataset.line;
    if (!a) return;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'room') { view = 'room'; render(); }
    if (a === 'list') { view = 'list'; quoting = null; render(); }
    if (a === 'retry') { thread.msgs = thread.msgs.filter((m) => !m.err); save(); refreshLog(); reply(); }
    if (a === 'unquote') { quoting = null; showQuoting(); }
    if (a === 'unpop') unpop();
    if (a === 'more') moreMenu();
    if (a === 'search') searchPanel();
    if (a === 'photo') { screen.querySelector('.bp-line-file').dataset.for = 'msg'; screen.querySelector('.bp-line-file').click(); }
    if (a === 'bg') { unpop(); screen.querySelector('.bp-line-file').dataset.for = 'bg'; screen.querySelector('.bp-line-file').click(); }
    if (a === 'bgreset') { bg = null; await store.del('linebg:' + ch.key).catch(() => {}); unpop(); renderRoom(); }
    if (a === 'clear') {
      if (!confirm(`清除跟 ${ch.name} 的整段 LINE？清掉就回不來了。`)) return;
      thread.msgs = []; thread.readTs = 0; save(); unpop(); refreshLog();
    }
    if (a === 'doedit' || a === 'doresend') {
      const id = e.target.closest('[data-id]').dataset.id;
      const text = screen.querySelector('.bp-line-edit textarea').value.trim();
      const m = find(id);
      if (!text && !m.img) return;
      m.text = text;
      if (a === 'doresend') {
        const i = thread.msgs.indexOf(m);
        thread.msgs = thread.msgs.slice(0, i + 1);
        m.ts = Date.now(); thread.readTs = 0;
        save(); unpop(); refreshLog(); scheduleReply();
      } else { save(); unpop(); refreshLog(); }
    }
  });

  screen.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('bp-line-file')) return;
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !ch) return;
    if (e.target.dataset.for === 'bg') {
      bg = await store.shrink(f, 1290);
      await store.set('linebg:' + ch.key, bg).catch(() => say('背景存不下'));
      renderRoom();
    } else {
      send({ text: '', img: await store.shrink(f, 1024, 0.8) });
    }
  });

  screen.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = screen.querySelector('.bp-line-input');
    const text = inp.value.trim();
    if (!text || !ch) return;
    inp.value = '';
    send({ text });
    inp.focus({ preventScroll: true });
  });

  return {
    open() { view = 'list'; render(); },
    refresh: render,
  };
}
