// LINE：跟現在酒館開著的角色傳訊息。
// 回覆走酒館自己的 generateQuietPrompt，所以模型看得到角色卡、世界書與正文。

const STORE = 'brume-phone:line:';

const ctx = () => window.SillyTavern?.getContext?.();
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hm = (ts) => { const d = new Date(ts); return `${d.getHours() < 12 ? '上午' : '下午'} ${(d.getHours() % 12) || 12}:${pad(d.getMinutes())}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

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

function loadThread(key) {
  try { return JSON.parse(localStorage.getItem(STORE + key)) || { msgs: [] }; } catch { return { msgs: [] }; }
}
function saveThread(key, t) {
  try { localStorage.setItem(STORE + key, JSON.stringify(t)); } catch { /* 存不下就算了，畫面照常 */ }
}

function buildPrompt(ch, msgs) {
  const now = new Date();
  const when = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（週${WEEK[now.getDay()]}）${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const log = msgs.slice(-40).map((m) => `${m.me ? ch.user : ch.name}：${m.text}`).join('\n');
  return [
    '[Brume Phone · LINE]',
    `現在不是在寫劇情正文。${ch.name} 正在用手機的 LINE 跟 ${ch.user} 傳訊息。`,
    `現在時間：${when}（現實時間）`,
    '',
    '最近的 LINE 對話（舊→新）：',
    log || '（還沒有對話）',
    '',
    `請以 ${ch.name} 的身分回 LINE：`,
    '- 只寫他會傳出去的訊息文字，不寫動作、旁白、心理描寫',
    '- 像真人傳訊息：短句，一則一行，1～4 則',
    '- 不要加名字、引號、時間或任何標記',
    '- 用跟對話一樣的語言',
  ].join('\n');
}

async function generate(prompt) {
  const c = ctx();
  const fn = c?.generateQuietPrompt;
  if (!fn) throw new Error('找不到酒館的生成功能');
  // 新版酒館吃物件參數，舊版吃一串位置參數
  const src = String(fn);
  const objectStyle = /^\s*(async\s+)?(function\s*\w*\s*)?\(\s*\{/.test(src);
  const out = objectStyle
    ? await fn.call(c, { quietPrompt: prompt, skipWIAN: false, removeReasoning: true })
    : await fn.call(c, prompt, false, false);
  return String(out || '');
}

function parseReply(raw, ch) {
  const namePrefix = new RegExp(`^(${ch.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${ch.user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*[:：]\\s*`);
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .split('\n')
    .map((l) => l.trim().replace(namePrefix, '').replace(/^[「『"]+|[」』"]+$/g, '').trim())
    .filter((l) => l && !/^[-*_]{3,}$/.test(l))
    .slice(0, 6);
}

export function createLine({ screen, say, onUnread }) {
  let ch = null;
  let thread = null;
  let view = 'list';
  let busy = false;
  let timer = null;

  function unreadCount() {
    if (!thread) return 0;
    return thread.msgs.filter((m) => !m.me && m.ts > (thread.seen || 0)).length;
  }

  function render() {
    ch = currentChar();
    if (!ch) {
      screen.innerHTML = `<div class="bp-line"><div class="bp-line-head"><span class="bp-back" data-line="home">‹</span><b>聊天</b><span></span></div>
        <div class="bp-line-empty">先在酒館選一個角色，<br>他的 LINE 就會出現在這裡。</div></div>`;
      return;
    }
    thread = loadThread(ch.key);
    if (view === 'list') renderList(); else renderRoom();
  }

  function avatar(cls = '') {
    return ch.avatar
      ? `<img class="bp-line-av ${cls}" src="${ch.avatar}" alt="">`
      : `<span class="bp-line-av ${cls} bp-line-av-txt">${esc(ch.name.slice(0, 1))}</span>`;
  }

  function renderList() {
    const last = thread.msgs[thread.msgs.length - 1];
    const n = unreadCount();
    screen.innerHTML = `<div class="bp-line">
      <div class="bp-line-head"><span class="bp-back" data-line="home">‹</span><b>聊天</b><span></span></div>
      <div class="bp-line-row" data-line="room">
        ${avatar()}
        <div class="bp-line-row-mid"><div class="bp-line-row-name">${esc(ch.name)}</div>
          <div class="bp-line-row-last">${last ? esc(last.text) : '傳個訊息給他吧'}</div></div>
        <div class="bp-line-row-end"><div class="bp-line-row-time">${last ? hm(last.ts) : ''}</div>
          ${n ? `<span class="bp-line-badge">${n}</span>` : ''}</div>
      </div></div>`;
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
        out += `<div class="bp-line-msg bp-me"><div class="bp-line-meta">${m.ts <= readUpTo ? '已讀<br>' : ''}${hm(m.ts)}</div><div class="bp-line-bub">${esc(m.text)}</div></div>`;
      } else if (m.err) {
        out += `<div class="bp-line-sys">${esc(m.text)}　<u data-line="retry">再試一次</u></div>`;
      } else {
        // 跟 LINE 一樣：連續好幾則只有第一則有頭像
        const first = !prev;
        out += `<div class="bp-line-msg bp-him${first ? '' : ' bp-cont'}">${first ? avatar('sm') : '<span class="bp-line-av sm bp-ghost"></span>'}<div class="bp-line-bub">${esc(m.text)}</div><div class="bp-line-meta">${hm(m.ts)}</div></div>`;
      }
    }
    if (busy === 'typing') out += `<div class="bp-line-msg bp-him">${prevHim ? '<span class="bp-line-av sm bp-ghost"></span>' : avatar('sm')}<div class="bp-line-bub bp-typing"><i></i><i></i><i></i></div></div>`;
    return out;
  }

  function renderRoom(keepInput) {
    const input = screen.querySelector('.bp-line-input');
    const draft = keepInput && input ? input.value : '';
    thread.seen = Date.now(); saveThread(ch.key, thread); onUnread?.(0);
    screen.innerHTML = `<div class="bp-line bp-line-roomv">
      <div class="bp-line-head"><span class="bp-back" data-line="list">‹</span><b>${esc(ch.name)}</b><span></span></div>
      <div class="bp-line-log">${bubbles()}</div>
      <form class="bp-line-bar"><input class="bp-line-input" placeholder="輸入訊息" enterkeyhint="send" autocomplete="off">
        <button type="submit" aria-label="傳送">➤</button></form></div>`;
    const log = screen.querySelector('.bp-line-log'); log.scrollTop = log.scrollHeight;
    const inp = screen.querySelector('.bp-line-input'); inp.value = draft;
    if (keepInput) inp.focus({ preventScroll: true });
  }

  function refreshLog() {
    const log = screen.querySelector('.bp-line-log');
    if (!log) return;
    log.innerHTML = bubbles(); log.scrollTop = log.scrollHeight;
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
    let lines;
    try {
      t.msgs = t.msgs.filter((m) => !m.err);
      lines = parseReply(await generate(buildPrompt(who, t.msgs)), who);
      if (!lines.length) throw new Error('他沒有回出字來');
    } catch (e) {
      busy = false;
      t.msgs.push({ me: false, err: true, text: `沒有回覆（${e.message || e}）`, ts: Date.now() });
      saveThread(who.key, t); if (view === 'room') refreshLog();
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      if (i) { busy = 'typing'; if (view === 'room') refreshLog(); await sleep(700 + Math.min(lines[i].length * 60, 1600)); }
      t.msgs.push({ me: false, text: lines[i], ts: Date.now() });
      busy = i < lines.length - 1 ? 'typing' : false;
      saveThread(who.key, t);
      if (view === 'room' && currentChar()?.key === who.key) { t.seen = Date.now(); refreshLog(); }
      else onUnread?.(unreadCount());
    }
    busy = false;
    if (view === 'room') refreshLog();
    // 回覆期間她又傳了新的，就再回一輪
    if (t.msgs[t.msgs.length - 1]?.me) scheduleReply();
  }

  screen.addEventListener('click', (e) => {
    const a = e.target.closest('[data-line]')?.dataset.line;
    if (!a) return;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'room') { view = 'room'; render(); }
    if (a === 'list') { view = 'list'; render(); }
    if (a === 'retry') { thread.msgs = thread.msgs.filter((m) => !m.err); saveThread(ch.key, thread); refreshLog(); reply(); }
  });
  screen.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = screen.querySelector('.bp-line-input');
    const text = inp.value.trim();
    if (!text || !ch) return;
    inp.value = '';
    thread.msgs = thread.msgs.filter((m) => !m.err);
    thread.msgs.push({ me: true, text, ts: Date.now() });
    saveThread(ch.key, thread);
    refreshLog();
    inp.focus({ preventScroll: true });
    scheduleReply();
  });

  return {
    open() { view = 'list'; render(); },
    refresh: render,
  };
}
