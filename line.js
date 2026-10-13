// LINE：跟現在酒館開著的角色傳訊息。
// 回覆走酒館自己的 generateQuietPrompt，所以模型看得到角色卡、世界書與正文。

import * as store from './store.js';
import { currentChar, generate, ctx, writeLore } from './st.js';
import * as data from './data.js';
import * as stage from './stage.js';

const OLD_STORE = 'brume-phone:line:'; // v0.2.0 存在 localStorage，第一次打開時搬進 IndexedDB

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
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0"/><circle cx="9.3" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="14.7" cy="10" r=".9" fill="currentColor" stroke="none"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12l-11.5 1.9z"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>',
  alarm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M4.5 5 7 3M19.5 5 17 3"/></svg>',
};

const ALARM_KEY = 'brume-phone:alarm-shortcut';
const LORE_KEY = 'brume-phone:lore';
const loreOn = () => { try { return localStorage.getItem(LORE_KEY) === '1'; } catch { return false; } };
const alarmShortcut = () => { try { return localStorage.getItem(ALARM_KEY) || 'Brume 設鬧鐘'; } catch { return 'Brume 設鬧鐘'; } };
const MS_MSGS = [50, 100, 300, 520, 1000, 1314, 2000, 3000, 5000, 10000];
const MS_DAYS = [7, 30, 50, 100, 200, 365, 520, 730, 1000];

// 聊天列表的時間：今天顯示時刻，昨天顯示「昨天」，更早顯示日期
function listTime(ts) {
  const d = new Date(ts); const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (day(now) - day(d)) / 864e5;
  if (diff === 0) return hm(ts);
  if (diff === 1) return '昨天';
  if (diff < 7) return `星期${WEEK[d.getDay()]}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const TAB = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5c-5 0-9 3.2-9 7.2 0 3.6 3.2 6.6 7.5 7.1l-.5 2.4c-.1.4.3.7.7.5 3.3-1.9 7.3-4.7 8.6-6.7.9-1 1.7-2.1 1.7-3.3 0-4-4-7.2-9-7.2z"/></svg>',
  voom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="16" rx="4"/><path d="M10 9v6l5-3z"/></svg>',
  news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3.5" y="6" width="17" height="13" rx="3"/><path d="M16 12.5h4.5M7 6l8-2.5V6"/></svg>',
};

async function loadThread(key) {
  let t = await store.get('line:' + key).catch(() => null);
  if (!t) {
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD_STORE + key)); } catch { old = null; }
    if (old?.msgs?.length) {
      for (const m of old.msgs) m.id ||= uid();
      await store.set('line:' + key, old).catch(() => {});
      try { localStorage.removeItem(OLD_STORE + key); } catch { /* 沒有就算了 */ }
      return old;
    }
    // 空的不存：不然另一台裝置還沒拿到伺服器的資料前，會用一份「比較新的空白」把它蓋掉
    return { msgs: [] };
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

// 劇情／現實兩種時間：m.now = 現實時間傳的；m.story = 劇情時間傳的（m.st 是劇情裡的時刻）。
// 舊紀錄兩個都沒有，照原本的現實時間顯示。現實聊天預設不給劇情看，t.nowSync 打開才給。
const storySees = (m, t) => !m.now || !!t.nowSync;

function msgText(m) {
  if (m.sticker) return `［貼圖：${m.sticker.tag}］`;
  if (m.alarm) return `［鬧鐘卡 ${m.alarm.time}「${m.alarm.label}」］`;
  if (m.moment) return `（動態：${m.moment}）`;
  return m.img ? `［照片］${m.text ? ' ' + m.text : ''}` : m.text;
}

// 正文那邊要看的：最近的 LINE 與記憶書（「讓正文知道」打開時才送）
export async function syncMain() {
  const c = ctx(); const ch = currentChar();
  if (!c?.setExtensionPrompt) return;
  const off = () => c.setExtensionPrompt('brume-phone-line', '', 1, 4);
  if (!ch) return off();
  const t = await loadThread(ch.key);
  if (t.sync === false) return off(); // 預設打開
  const mem = await data.memory.all(ch.key);
  const recent = t.msgs.filter((m) => !m.err && storySees(m, t)).slice(-20)
    .map((m) => `${m.me ? ch.user : ch.name}：${msgText(m)}${m.now ? '（現實裡傳的）' : ''}`).join('\n');
  const text = [
    `[手機 LINE] ${ch.name} 跟 ${ch.user}（${stage.name(await stage.get(ch.key))}）平常也會用 LINE 聊天，下面是最近聊的（${ch.name} 記得這些，可以自然提到，不用每次都提）：`,
    recent || '（還沒聊）',
    mem.length ? `\n${ch.name} 記得的事：\n${mem.map((x) => '- ' + x.text).join('\n')}` : '',
  ].join('\n');
  c.setExtensionPrompt('brume-phone-line', text, 1, 4);
}

function buildPrompt(ch, msgs, x = {}) {
  const now = new Date();
  const when = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（週${WEEK[now.getDay()]}）${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const pos = herPositions(msgs);
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const nowMode = x.mode === 'now';
  const shown = msgs.filter((m) => !m.err && (nowMode ? m.now : (!m.now || x.nowSync)));
  const log = shown.slice(-40).map((m) => {
    const q = m.quote && byId.get(m.quote);
    const quoted = q ? `（回覆「${msgText(q).slice(0, 40)}」）` : '';
    const react = m.me ? (m.hisReact ? `（你按了 ${REACTS[m.hisReact]}）` : '') : (m.myReact ? `（她按了 ${REACTS[m.myReact]}）` : '');
    const tag = !nowMode && m.now ? '（現實裡傳的）' : '';
    return m.me
      ? `${ch.user}［${pos.get(m.id)}］：${quoted}${msgText(m)}${react}${tag}`
      : `${ch.name}：${quoted}${msgText(m)}${react}${tag}`;
  }).join('\n');
  const timeLine = nowMode
    ? `現在時間：${when}（現實時間）。這不是劇情裡的時刻，是 ${ch.user} 在現實生活裡打開手機找你：她可能想分享現實裡開心或難過的事、想撒嬌，或想跟你親密。陪她活在現實的此刻，不要把話題硬拉回劇情的場景。`
    : `時間照劇情走：先從正文最近的劇情判斷故事裡現在是哪一天、幾點、${ch.name} 人在哪裡做什麼，照那個時間點回；不要用現實的時鐘。`;
  return [
    '[Brume Phone · LINE]',
    `現在不是在寫劇情正文。${ch.name} 正在用手機的 LINE 跟 ${ch.user} 傳訊息。`,
    timeLine,
    x.stage ? `你們現在的關係：${stage.name(x.stage)}（${stage.tone(x.stage)}）。說話的親密程度照這個來` : '',
    x.sleep ? `\n【陪睡模式】${ch.user} 躺在床上準備睡了，要你陪她入睡。講話輕、短、慢，像在耳邊說；不問問題、不開新話題、不要讓她更清醒。她說晚安就溫柔收尾。` : '',
    x.memory?.length ? `\n${ch.name} 記得的事：\n${x.memory.map((m) => '- ' + m.text).join('\n')}` : '',
    x.notes?.length ? `\n她冰箱上的便條（你貼過的也在裡面）：\n${x.notes.map((n) => `- ${n.text}${n.date ? `（${n.date}）` : ''}${n.done ? '（已完成）' : ''}`).join('\n')}` : '',
    x.cal?.length ? `\n你們共用的行事曆（之後的）：\n${x.cal.map((e) => `- ${e.date} ${e.title}`).join('\n')}` : '',
    '',
    `最近的 LINE 對話（舊→新；${ch.user} 名字後面的［數字］是她那則訊息的位置，0 是最新的）：`,
    log || '（還沒有對話）',
    '',
    x.proactive || `請以 ${ch.name} 的身分回 LINE：`,
    '- 只寫他會傳出去的訊息文字，不寫動作、旁白、心理描寫',
    '- 像真人傳訊息：短句，一則一行，1～4 則',
    '- 不要加名字、引號、時間',
    nowMode ? '' : '- 在回覆最前面獨立一行寫 [[TIME|HH:MM]]：劇情裡你傳出這些訊息的時刻（24 小時制）',
    '- 用跟對話一樣的語言',
    '',
    '想做的話可以加這些小動作（不用每次都做）：',
    '- 引用她的某一句來回：在回覆最前面獨立一行寫 [[QUOTE|位置]]',
    '- 對她的某則訊息回貼表符：在回覆最後獨立一行寫 [[REACT|位置|表符]]，表符只能是 heart、lol、tear、wow、hug、huh 其中一個，一次最多一個',
    x.stickerTags?.length ? `- 傳貼圖：在回覆最後獨立一行寫 [[STICKER|tag]]，tag 只能是：${x.stickerTags.join('、')}。一次最多一張` : '',
    '- 她明確請你設鬧鐘或提醒時（例如「明天六點叫我」），先答應，再在最後獨立一行寫 [[ALARM|HH:MM|鬧鐘名稱]]，24 小時制，名稱是你留給她的一句話，10 字內、不用 emoji。她沒要求就不要寫',
    '- 想在她冰箱上貼便條（叮嚀、提醒、想說的話）：最後獨立一行寫 [[NOTE|內容]] 或 [[NOTE|內容|YYYY-MM-DD]]，20 字內。偶爾才貼，貼了就在訊息裡順口提一下',
    '- 對話裡真的約好的事、重要的日子，可以記上行事曆：最後獨立一行寫 [[CAL|YYYY-MM-DD|標題]]，標題 12 字內。行事曆上已經有的不要再記',
    '- 想讓她知道你正在做什麼（不是對她說話，像「他去洗澡了」那種旁白小字）：寫 [[MOMENT|一句話]]。很偶爾才用',
  ].filter((l) => l !== '').join('\n');
}

function parseReply(raw, ch) {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  let quote = null; let react = null; let alarm = null; let sticker = null; let time = null;
  text = text.replace(/\[\[TIME\|(\d{1,2}:\d{2})\]\]/i, (_, t) => { time = t.padStart(5, '0'); return ''; });
  const notes = []; const cals = []; const moments = [];
  text = text.replace(/\[\[QUOTE\|(\d+)\]\]/i, (_, p) => { quote = +p; return ''; });
  text = text.replace(/\[\[REACT\|(\d+)\|(\w+)\]\]/i, (_, p, id) => { if (REACTS[id]) react = { pos: +p, id }; return ''; });
  text = text.replace(/\[\[ALARM\|(\d{1,2}:\d{2})\|([^\]]*)\]\]/i, (_, t, l) => { alarm = { time: t.padStart(5, '0'), label: l.trim() }; return ''; });
  text = text.replace(/\[\[STICKER\|([^\]]+)\]\]|\[貼圖\|([^\]]+)\]/i, (_, a, b) => { sticker = (a || b).trim(); return ''; });
  text = text.replace(/\[\[NOTE\|([^|\]]+)(?:\|(\d{4}-\d{2}-\d{2}))?\]\]/gi, (_, t, d) => { notes.push({ text: t.trim(), ...(d ? { date: d } : {}) }); return ''; });
  text = text.replace(/\[\[CAL\|(\d{4}-\d{2}-\d{2})\|([^\]]+)\]\]/gi, (_, d, t) => { cals.push({ date: d, title: t.trim() }); return ''; });
  text = text.replace(/\[\[MOMENT\|([^\]]+)\]\]/gi, (_, t) => { moments.push(t.trim()); return ''; });
  text = text.replace(/\[\[[^\]]*\]\]/g, '');
  const namePrefix = new RegExp(`^(${reEsc(ch.name)}|${reEsc(ch.user)})\\s*[:：]\\s*`);
  const lines = text
    .split('\n')
    .map((l) => l.trim().replace(namePrefix, '').replace(/^[「『"]+|[」』"]+$/g, '').trim())
    .filter((l) => l && !/^[-*_]{3,}$/.test(l))
    .slice(0, 6);
  return { lines, quote, react, alarm, sticker, notes, cals, moments, time };
}

export function createLine({ screen, say, onUnread, onData }) {
  let ch = null;
  let thread = null;
  let bg = null;
  let view = 'list';
  let busy = false;
  let timer = null;
  let quoting = null;
  let renderToken = 0;
  let stickerOpen = false;
  let curStage = 'meet';
  let pendingSticker = null;
  let msQueue = [];

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
    thread = t; bg = b; curStage = await stage.get(ch.key);
    if (view === 'list') renderList();
    else if (view === 'memory') renderMemory();
    else if (view === 'cards') renderCards();
    else if (view === 'stickers') renderStickers();
    else renderRoom();
  }

  function avatar(cls = '') {
    return ch.avatar
      ? `<img class="bp-line-av ${cls}" src="${ch.avatar}" alt="">`
      : `<span class="bp-line-av ${cls} bp-line-av-txt">${esc(ch.name.slice(0, 1))}</span>`;
  }

  function renderList() {
    const last = [...thread.msgs].reverse().find((m) => !m.err);
    const n = unreadCount();
    const lastText = !last ? '' : last.sticker ? (last.me ? '妳傳送了貼圖' : `${ch.name}傳送了貼圖`) : last.alarm ? '鬧鐘' : (last.moment || last.notice) ? (last.moment || last.notice) : last.img && !last.text ? (last.me ? '妳傳送了照片' : `${ch.name}傳送了照片`) : last.text;
    screen.innerHTML = `<div class="bp-line bp-line-listv">
      <div class="bp-line-lhead"><span class="bp-back" data-line="home">‹</span><b>聊天</b>
        <span class="bp-line-tools"><i>${IC.search}</i></span></div>
      <div class="bp-line-lsearch">${IC.search}<span>搜尋</span></div>
      <div class="bp-line-rows">
        <div class="bp-line-row" data-line="room">
          ${avatar()}
          <div class="bp-line-row-mid"><div class="bp-line-row-name">${esc(ch.name)}</div>
            <div class="bp-line-row-last">${esc(lastText)}</div></div>
          <div class="bp-line-row-end"><div class="bp-line-row-time">${last ? listTime(last.ts) : ''}</div>
            ${n ? `<span class="bp-line-badge">${n}</span>` : ''}</div>
        </div>
      </div>
      <div class="bp-line-tabs">
        <span>${TAB.home}<i>主頁</i></span><span class="on">${TAB.chat}<i>聊天</i></span>
        <span>${TAB.voom}<i>VOOM</i></span><span>${TAB.news}<i>新聞</i></span><span>${TAB.wallet}<i>錢包</i></span>
      </div></div>`;
  }

  function quoteBox(m) {
    const q = m.quote && find(m.quote);
    if (!q) return '';
    return `<div class="bp-line-qbox" data-jump="${q.id}"><b>${q.me ? esc(ch.user) : esc(ch.name)}</b>${esc(q.img && !q.text ? '照片' : q.text).slice(0, 60)}</div>`;
  }

  function bubble(m) {
    const react = m.me ? m.hisReact : m.myReact;
    const body = m.sticker
      ? `<img class="bp-line-sticker" src="${m.sticker.img}" alt="${esc(m.sticker.tag)}">`
      : m.alarm
      ? `<div class="bp-line-alarm" data-alarm="${m.id}"><i>${IC.alarm}</i><div><b>${esc(m.alarm.time)}</b><span>${esc(m.alarm.label)}</span><small>點一下設定鬧鐘</small></div></div>`
      : m.img
      ? `<img class="bp-line-img" src="${m.img}" alt="">${m.text ? `<div class="bp-line-bub">${esc(m.text)}</div>` : ''}`
      : `<div class="bp-line-bub">${quoteBox(m)}${esc(m.text)}</div>`;
    return `<div class="bp-line-bwrap" data-id="${m.id}">${body}${react ? `<span class="bp-line-react">${REACTS[react]}</span>` : ''}</div>`;
  }

  function bubbles() {
    let out = ''; let lastDay = '';
    const readUpTo = thread.readTs || 0;
    let prevHim = false; let prevMe = false;
    for (const m of thread.msgs) {
      const d = new Date(m.ts); const day = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
      if (!m.story && day !== lastDay) { out += `<div class="bp-line-day"><span>${day}</span></div>`; lastDay = day; prevHim = false; prevMe = false; }
      const when = m.story ? (m.st || '') : hm(m.ts);
      const prev = prevHim; const prevMine = prevMe;
      prevHim = !m.me && !m.err; prevMe = !!m.me;
      if (m.moment || m.notice) {
        out += `<div class="bp-line-moment${m.notice ? ' bp-notice' : ''}"${m.goto ? ` data-goto="${m.goto}"` : ''}><span>${esc(m.moment || m.notice)}</span></div>`;
        prevHim = false; prevMe = false;
      } else if (m.me) {
        out += `<div class="bp-line-msg bp-me${prevMine ? ' bp-cont' : ' bp-tail'}"><div class="bp-line-meta">${m.ts <= readUpTo ? '已讀<br>' : ''}${when}</div>${bubble(m)}</div>`;
      } else if (m.err) {
        out += `<div class="bp-line-sys">${esc(m.text)}　<u data-line="retry">再試一次</u></div>`;
      } else {
        // 跟 LINE 一樣：連續好幾則只有第一則有頭像
        out += `<div class="bp-line-msg bp-him${prev ? ' bp-cont' : ' bp-tail'}">${prev ? '<span class="bp-line-av sm bp-ghost"></span>' : avatar('sm')}${bubble(m)}<div class="bp-line-meta">${when}</div></div>`;
      }
    }
    if (busy === 'typing') out += `<div class="bp-line-msg bp-him${prevHim ? ' bp-cont' : ' bp-tail'}">${prevHim ? '<span class="bp-line-av sm bp-ghost"></span>' : avatar('sm')}<div class="bp-line-bub bp-typing"><i></i><i></i><i></i></div></div>`;
    return out;
  }

  function renderRoom() {
    thread.seen = Date.now(); if (thread.msgs.length) save(); onUnread?.(0); // 空的不存，理由同 loadThread
    screen.innerHTML = `<div class="bp-line bp-line-roomv${thread.sleep ? ' bp-line-sleep' : ''}">
      <div class="bp-line-head"><span class="bp-back" data-line="list">‹</span><b>${esc(ch.name)}</b>
        <span class="bp-line-tools"><i data-line="search">${IC.search}</i><i data-line="more">${IC.more}</i></span></div>
      ${thread.sleep ? '<div class="bp-line-sleepbar" data-line="sleep">🌙 陪睡模式中・點這裡結束</div>' : ''}
      <div class="bp-line-modebar${thread.mode === 'now' ? ' bp-now' : ''}" data-line="mode">${thread.mode === 'now' ? '現實時間・他知道現在幾點　<u>換回劇情</u>' : '劇情時間・跟著正文走　<u>換成現實</u>'}</div>
      <div class="bp-line-body"${bg && !thread.sleep ? ` style="background-image:url('${bg}')"` : ''}>
        <div class="bp-line-log">${bubbles()}</div>
      </div>
      <div class="bp-line-quoting" hidden></div>
      <form class="bp-line-bar">
        <i class="bp-line-plus" data-line="photo">${IC.plus}</i>
        <i class="bp-line-plus bp-hide-typing" data-line="photo">${IC.camera}</i>
        <i class="bp-line-plus bp-hide-typing" data-line="photo">${IC.photo}</i>
        <span class="bp-line-field"><input class="bp-line-input" placeholder="Aa" enterkeyhint="send" autocomplete="off"><i data-line="stickers">${IC.smile}</i></span>
        <button type="submit" aria-label="傳送">${IC.send}</button></form>
      <div class="bp-line-stk" hidden></div>
      <input class="bp-line-file" type="file" accept="image/*" hidden>
      <div class="bp-line-pop"></div></div>`;
    showQuoting();
    stickerOpen = false;
    showMilestone();
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
        ${m.text && stage.unlocked(curStage, 'cards') ? btn('keep', 'save', '收藏') : ''}
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

  function askSheet(title, value, action, id = '', hint = '', rows = 3) {
    const card = pop(`<div class="bp-line-edit"><b>${title}</b>
      <textarea rows="${rows}">${esc(value)}</textarea>${hint ? `<p class="soft">${hint}</p>` : ''}
      <div class="bp-line-edit-btns"><button data-line="unpop">取消</button><button class="ok" data-line="${action}" data-id="${id}">好</button></div></div>`, 'bp-center-mode');
    const ta = card.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  // 還沒解鎖的功能照樣列出來，標上要到哪個關係才會開
  function lockedBtn(feature, label) {
    return stage.unlocked(curStage, feature)
      ? `<button data-line="${feature}">${label}</button>`
      : `<button data-line="locked" data-need="${stage.needFor(feature)}" class="muted">🔒 ${label}・${stage.needFor(feature)}後解鎖</button>`;
  }

  function moreMenu() {
    pop(`<div class="bp-line-list">
      <button data-line="sync" class="bp-line-switch">讓正文知道 LINE 聊了什麼<i class="${thread.sync !== false ? 'on' : ''}"></i></button>
      <button data-line="nowsync" class="bp-line-switch">現實時間聊的也讓劇情知道<i class="${thread.nowSync ? 'on' : ''}"></i></button>
      ${lockedBtn('sleep', thread.sleep ? '結束陪睡模式' : '🌙 陪睡模式')}
      <button data-line="memory">記憶書</button>
      ${lockedBtn('cards', '收藏的字卡')}
      <button data-line="stickermgr">管理貼圖</button>
      <button data-line="alarmset">鬧鐘捷徑設定</button>
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

  // ---------- 其他頁：記憶書、字卡、貼圖管理 ----------
  function subHead(title, extra = '') {
    return `<div class="bp-line-head bp-line-subhead"><span class="bp-back" data-line="room">‹</span><b>${title}</b><span class="bp-line-tools">${extra}</span></div>`;
  }

  async function renderMemory() {
    const mem = await data.memory.all(ch.key);
    screen.innerHTML = `<div class="bp-line bp-line-sub">${subHead('記憶書')}
      <div class="bp-line-subbody">
        <p class="bp-line-subhint">${esc(ch.name)}從 LINE 裡記住的事。每聊三十則會自己整理一次，也可以手動整理；不對的可以改或刪。</p>
        <button class="bp-line-wide" data-line="summarize">現在整理一次</button>
        <button class="bp-line-switch bp-line-lore" data-line="lore">同步寫進酒館的世界書<i class="${loreOn() ? 'on' : ''}"></i></button>
        <p class="bp-line-subhint">打開之後，新整理出來的記憶會寫成這個聊天綁的世界書條目（沒有就寫角色卡綁的那本），正文跟 Memory Books 的記憶放在一起。條目名稱會標「📱 Brume Phone」。${loreOn() ? '<br><u data-line="loreall">把現在這些也寫進去</u>' : ''}</p>
        ${mem.length ? mem.map((m) => `<div class="bp-line-mem"><span>${esc(m.text)}</span><i data-memedit="${m.id}">${IC.edit}</i><i data-memdel="${m.id}">${IC.del}</i></div>`).join('') : '<p class="bp-line-subhint">還沒有記憶。</p>'}
      </div><div class="bp-line-pop"></div></div>`;
  }

  async function renderCards() {
    const cs = await data.cards.all(ch.key);
    screen.innerHTML = `<div class="bp-line bp-line-sub">${subHead('收藏的字卡')}
      <div class="bp-line-subbody">
        ${cs.length ? cs.map((c) => `<div class="bp-line-card"><p>${esc(c.text)}</p><small>—— ${esc(c.who)}・${new Date(c.ts).getMonth() + 1}/${new Date(c.ts).getDate()}</small><i data-carddel="${c.id}">${IC.del}</i></div>`).join('') : '<p class="bp-line-subhint">長按喜歡的那句話，選「收藏」，就會存成字卡放在這裡。</p>'}
      </div></div>`;
  }

  async function renderStickers() {
    const ss = await data.stickers.all();
    screen.innerHTML = `<div class="bp-line bp-line-sub">${subHead('管理貼圖')}
      <div class="bp-line-subbody">
        <p class="bp-line-subhint">貼圖所有角色共用。每張要取一個標籤（例如「抱抱」「生氣」），他會照標籤挑來貼。</p>
        <div class="bp-line-stkgrid">
          ${ss.map((x) => `<div class="bp-line-stkitem"><img src="${x.img}" alt=""><span>${esc(x.tag)}</span><i data-stkdel="${x.id}">✕</i></div>`).join('')}
          <div class="bp-line-stkitem bp-add" data-line="stkadd">${IC.plus}<span>新增</span></div>
        </div>
      </div>
      <input class="bp-line-file" type="file" accept="image/*" hidden>
      <div class="bp-line-pop"></div></div>`;
  }

  async function toggleStickers() {
    const panel = screen.querySelector('.bp-line-stk');
    if (!panel) return;
    stickerOpen = !stickerOpen;
    panel.hidden = !stickerOpen;
    if (!stickerOpen) return;
    const ss = await data.stickers.all();
    panel.innerHTML = ss.length
      ? `<div class="bp-line-stkgrid">${ss.map((x) => `<div class="bp-line-stkitem" data-stksend="${x.id}"><img src="${x.img}" alt=""></div>`).join('')}</div>`
      : '<p class="bp-line-subhint">還沒有貼圖。<u data-line="stickermgr">去新增</u></p>';
  }

  // 里程碑：第 N 則訊息、認識第 N 天
  function checkMilestones() {
    if (!stage.unlocked(curStage, 'milestones')) return;
    const msgs = thread.msgs.filter((m) => !m.err && !m.notice && !m.moment);
    if (!msgs.length) return;
    thread.ms ||= [];
    const n = msgs.length;
    const days = Math.floor((Date.now() - msgs[0].ts) / 864e5) + 1;
    for (const k of MS_MSGS) if (n >= k && !thread.ms.includes('m' + k)) { thread.ms.push('m' + k); if (n - k < 5) msQueue.push(`第 ${k} 則訊息`); }
    for (const k of MS_DAYS) if (days >= k && !thread.ms.includes('d' + k)) { thread.ms.push('d' + k); if (days - k < 2) msQueue.push(`認識第 ${k} 天`); }
    showMilestone();
  }
  function showMilestone() {
    const room = screen.querySelector('.bp-line-roomv');
    if (!room || !msQueue.length || room.querySelector('.bp-line-ms')) return;
    const text = msQueue.shift();
    room.insertAdjacentHTML('beforeend', `<div class="bp-line-ms" data-line="msclose"><div><i>✦</i><b>${text}</b><span>${esc(ch.user)} 和 ${esc(ch.name)}</span></div></div>`);
    setTimeout(() => { room.querySelector('.bp-line-ms')?.remove(); showMilestone(); }, 3600);
  }

  // 記憶書整理：從最近的對話挑出值得記的事
  async function summarize(manual) {
    if (!ch) return;
    const who = ch; const t = thread;
    const mem = await data.memory.all(who.key);
    const recent = t.msgs.filter((m) => !m.err && storySees(m, t)).slice(-40).map((m) => `${m.me ? who.user : who.name}：${msgText(m)}`).join('\n');
    if (!recent) { if (manual) say('還沒有對話可以整理'); return; }
    if (manual) say('整理中⋯');
    try {
      const raw = await generate([
        '[Brume Phone · 記憶書]',
        `現在不是在寫劇情正文。請從下面這段 LINE 對話裡，挑出 ${who.name} 應該長久記住的事：${who.user} 說過的喜好、近況、約定、發生的事。`,
        mem.length ? `已經記過的（不要重複）：\n${mem.map((m) => '- ' + m.text).join('\n')}` : '',
        '', recent, '',
        '每條一行，格式：記憶內容｜關鍵字1,關鍵字2。記憶 20 字內、用第三人稱寫；關鍵字是之後聊到時會出現的詞。最多 3 條。沒有值得記的就只輸出「無」。不要編號、不要其他文字。',
      ].filter(Boolean).join('\n'));
      const items = raw.split('\n').map((l) => l.replace(/^\s*[-*\d.、]+\s*/, '').trim()).filter((l) => l && l !== '無')
        .map((l) => { const [text, keys = ''] = l.split(/[｜|]/); return { text: text.trim(), keys: keys.split(/[,，、]/).map((k) => k.trim()).filter(Boolean).slice(0, 5) }; })
        .filter((x) => x.text && x.text.length <= 60).slice(0, 3);
      const lines = items.map((x) => x.text);
      for (const x of items) {
        await data.memory.add(who.key, x.text);
        if (loreOn()) { const r = await writeLore(`${who.user} 和 ${who.name} 在 LINE 上：${x.text}`, x.keys.length ? x.keys : [who.name]); if (!r.ok && manual) say(`沒寫進世界書：${r.why}`); }
      }
      t.memAt = t.msgs.length; saveThread(who.key, t);
      if (manual) { say(lines.length ? `記下了 ${lines.length} 件事` : '這段沒有新的要記'); if (view === 'memory') renderMemory(); }
      syncMain();
    } catch (e) { if (manual) say(`整理失敗：${e.message || e}`); }
  }

  // ---------- 送出、回覆 ----------
  function send(msg) {
    thread.msgs = thread.msgs.filter((m) => !m.err);
    thread.msgs.push({ id: uid(), me: true, ts: Date.now(), ...(thread.mode === 'now' ? { now: true } : { story: true }), ...msg, ...(quoting ? { quote: quoting } : {}) });
    quoting = null; showQuoting();
    if (stickerOpen) toggleStickers();
    checkMilestones();
    save(); refreshLog(); syncMain();
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
      const today = data.today();
      const [notes, cal, memory, stks] = await Promise.all([data.notes.all(who.key), data.cal.all(who.key), data.memory.all(who.key), data.stickers.all()]);
      const cur = await stage.get(who.key);
      const extra = { mode: t.mode === 'now' ? 'now' : 'story', nowSync: !!t.nowSync, stage: cur, sleep: t.sleep && stage.unlocked(cur, 'sleep'), notes: notes.filter((n) => !n.done).slice(0, 12), cal: cal.filter((e) => e.date >= today).slice(0, 12), memory, stickerTags: [...new Set(stks.map((x) => x.tag))] };
      out = parseReply(await generate(buildPrompt(who, t.msgs, extra), image), who);
      out.stickerObj = out.sticker ? stks.find((x) => x.tag === out.sticker) : null;
      if (!out.lines.length && !out.stickerObj && !out.alarm && !out.moments.length) throw new Error('他沒有回出字來');
    } catch (e) {
      busy = false;
      t.msgs.push({ id: uid(), me: false, err: true, text: `沒有回覆（${e.message || e}）`, ts: Date.now() });
      saveThread(who.key, t); if (view === 'room') refreshLog();
      return;
    }
    const flag = t.mode === 'now' ? { now: true } : { story: true, ...(out.time ? { st: out.time } : {}) };
    const pos = herPositions(t.msgs);
    const atPos = (p) => t.msgs.find((m) => m.me && pos.get(m.id) === p);
    if (out.react) { const target = atPos(out.react.pos); if (target) target.hisReact = out.react.id; }
    const quoteTarget = out.quote !== null ? atPos(out.quote) : null;
    for (let i = 0; i < out.lines.length; i++) {
      if (i) { busy = 'typing'; if (view === 'room') refreshLog(); await sleep(700 + Math.min(out.lines[i].length * 60, 1600)); }
      t.msgs.push({ id: uid(), me: false, text: out.lines[i], ts: Date.now(), ...flag, ...(i === 0 && quoteTarget ? { quote: quoteTarget.id } : {}) });
      busy = i < out.lines.length - 1 ? 'typing' : false;
      saveThread(who.key, t);
      if (view === 'room' && currentChar()?.key === who.key) { t.seen = Date.now(); refreshLog(); }
      else onUnread?.(unreadCount());
    }
    // 文字之後：貼圖、鬧鐘卡、動態、便條與行事曆
    const extras = [];
    if (out.stickerObj) extras.push({ sticker: { tag: out.stickerObj.tag, img: out.stickerObj.img } });
    if (out.alarm) extras.push({ alarm: out.alarm });
    for (const mo of out.moments) extras.push({ moment: mo });
    for (const n of out.notes) { await data.notes.add(who.key, { ...n, by: 'him' }); extras.push({ notice: `📌 ${who.name}在便條上寫了：${n.text}`, goto: 'notes' }); }
    for (const c of out.cals) { await data.cal.add(who.key, { ...c, by: 'him' }); extras.push({ notice: `📅 ${who.name}記上行事曆：${c.date.slice(5).replace('-', '/')} ${c.title}`, goto: 'calendar' }); }
    for (const x of extras) {
      if (x.sticker || x.alarm) { busy = 'typing'; if (view === 'room') refreshLog(); await sleep(700); }
      t.msgs.push({ id: uid(), me: false, text: '', ts: Date.now(), ...flag, ...x });
      saveThread(who.key, t);
      if (view === 'room') refreshLog();
    }
    if (out.notes.length || out.cals.length) onData?.();
    busy = false;
    if (view === 'room') refreshLog();
    if (thread === t) checkMilestones();
    syncMain();
    // 每多聊三十則，記憶書自己整理一次
    if (t.msgs.length - (t.memAt || 0) >= 30) summarize(false);
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
  // 這個畫面幾個 App 共用，不是 LINE 的畫面就不要動
  const mine = () => !!screen.querySelector('.bp-line');

  screen.addEventListener('click', async (e) => {
    if (!mine()) return;
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
      if (a === 'keep') askSheet('收藏成字卡', m.text, 'dokeep', id, '可以刪到只剩想留下的那一段。', 4);
      return;
    }
    const stk = e.target.closest('[data-stksend]');
    if (stk) { const x = (await data.stickers.all()).find((y) => y.id === stk.dataset.stksend); if (x) send({ text: '', sticker: { tag: x.tag, img: x.img } }); return; }
    const stkDel = e.target.closest('[data-stkdel]');
    if (stkDel) { await data.stickers.remove(stkDel.dataset.stkdel); renderStickers(); return; }
    const memEdit = e.target.closest('[data-memedit]');
    if (memEdit) { const m = (await data.memory.all(ch.key)).find((x) => x.id === memEdit.dataset.memedit); if (m) askSheet('改這條記憶', m.text, 'domemedit', m.id); return; }
    const memDel = e.target.closest('[data-memdel]');
    if (memDel) { await data.memory.remove(ch.key, memDel.dataset.memdel); syncMain(); renderMemory(); return; }
    const cardDel = e.target.closest('[data-carddel]');
    if (cardDel) { await data.cards.remove(ch.key, cardDel.dataset.carddel); renderCards(); return; }
    const alarm = e.target.closest('[data-alarm]');
    if (alarm) {
      const m = find(alarm.dataset.alarm);
      const url = `shortcuts://run-shortcut?name=${encodeURIComponent(alarmShortcut())}&input=text&text=${encodeURIComponent(`${m.alarm.time}|${m.alarm.label}`)}`;
      location.href = url;
      return;
    }
    const go = e.target.closest('[data-goto]');
    if (go) { screen.dispatchEvent(new CustomEvent('bp-openapp', { bubbles: true, detail: go.dataset.goto })); return; }
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
    if (a === 'stickers') toggleStickers();
    if (a === 'sync') {
      thread.sync = thread.sync === false; save(); unpop(); await syncMain();
      say(thread.sync ? '打開了，正文會知道 LINE 聊了什麼' : '關掉了，正文不會看到 LINE');
    }
    if (a === 'mode') {
      thread.mode = thread.mode === 'now' ? 'story' : 'now'; save(); renderRoom();
      say(thread.mode === 'now' ? '換成現實時間，他知道現在幾點' : '換回劇情時間，跟著正文走');
    }
    if (a === 'nowsync') {
      thread.nowSync = !thread.nowSync; save(); unpop(); await syncMain();
      say(thread.nowSync ? '打開了，劇情會知道現實時間聊了什麼' : '關掉了，現實時間聊的只留在手機裡');
    }
    if (a === 'locked') { say(`關係到「${e.target.closest('[data-need]').dataset.need}」才會打開`); return; }
    if (a === 'sleep') { thread.sleep = !thread.sleep; save(); unpop(); renderRoom(); say(thread.sleep ? '陪睡模式，他會講話輕一點' : '陪睡模式結束了'); }
    if (a === 'memory') { unpop(); view = 'memory'; renderMemory(); }
    if (a === 'cards') { unpop(); view = 'cards'; renderCards(); }
    if (a === 'stickermgr') { unpop(); view = 'stickers'; renderStickers(); }
    if (a === 'summarize') summarize(true);
    if (a === 'lore') { try { localStorage.setItem(LORE_KEY, loreOn() ? '0' : '1'); } catch { /* 存不了 */ } renderMemory(); say(loreOn() ? '之後的記憶會寫進世界書' : '不寫進世界書了'); }
    if (a === 'loreall') {
      const mem = await data.memory.all(ch.key); let n = 0; let why = '';
      for (const m of mem) { const r = await writeLore(`${ch.user} 和 ${ch.name} 在 LINE 上：${m.text}`, [ch.name]); if (r.ok) n++; else { why = r.why; break; } }
      say(why ? `沒寫進去：${why}` : `寫了 ${n} 條進世界書`);
    }
    if (a === 'msclose') e.target.closest('.bp-line-ms')?.remove();
    if (a === 'stkadd') { const f = screen.querySelector('.bp-line-file'); f.dataset.for = 'sticker'; f.click(); }
    if (a === 'alarmset') askSheet('鬧鐘捷徑的名字', alarmShortcut(), 'doalarmset', '', '點鬧鐘卡時，會叫 iPhone 的「捷徑」App 跑這個名字的捷徑。<br>做法：捷徑 App → 新增捷徑 → 加「分割文字」（自訂：|）→「從清單取得項目」第一項當時間、最後一項當名稱 →「製作鬧鐘」。捷徑的名字要跟這裡一樣。', 1);
    if (a === 'dokeep') {
      const text = screen.querySelector('.bp-line-edit textarea').value.trim();
      const m = find(e.target.closest('[data-id]').dataset.id);
      if (text && m) { await data.cards.add(ch.key, { text, who: m.me ? ch.user : ch.name }); say('收進字卡了'); }
      unpop();
    }
    if (a === 'domemedit') {
      const text = screen.querySelector('.bp-line-edit textarea').value.trim();
      const id = e.target.closest('[data-id]').dataset.id;
      if (text) await data.memory.update(ch.key, id, text); else await data.memory.remove(ch.key, id);
      syncMain(); renderMemory();
    }
    if (a === 'dostktag') {
      const tag = screen.querySelector('.bp-line-edit textarea').value.trim();
      if (!tag) return;
      await data.stickers.add({ tag, img: pendingSticker }); pendingSticker = null; renderStickers();
    }
    if (a === 'doalarmset') {
      const v = screen.querySelector('.bp-line-edit textarea').value.trim();
      try { if (v) localStorage.setItem(ALARM_KEY, v); } catch { /* 存不了就用預設 */ }
      unpop(); say('記住了');
    }
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
    if (!mine() || !e.target.classList.contains('bp-line-file')) return;
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !ch) return;
    if (e.target.dataset.for === 'sticker') {
      pendingSticker = await store.shrink(f, 320, 0.85, 'image/png');
      askSheet('這張貼圖的標籤', '', 'dostktag', '', '一兩個字就好，像「抱抱」「哭哭」「生氣」。他會照標籤挑。', 1);
      return;
    }
    if (e.target.dataset.for === 'bg') {
      bg = await store.shrink(f, 1290);
      await store.set('linebg:' + ch.key, bg).catch(() => say('背景存不下'));
      renderRoom();
    } else {
      send({ text: '', img: await store.shrink(f, 1024, 0.8) });
    }
  });

  // 打字時 LINE 會把左邊的相機、相片收起來，讓輸入框變長
  screen.addEventListener('input', (e) => {
    if (!e.target.classList.contains('bp-line-input')) return;
    e.target.closest('.bp-line-bar').classList.toggle('bp-typing-now', !!e.target.value);
  });

  screen.addEventListener('submit', (e) => {
    if (!mine()) return;
    e.preventDefault();
    const inp = screen.querySelector('.bp-line-input');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text || !ch) return;
    inp.value = ''; inp.closest('.bp-line-bar').classList.remove('bp-typing-now');
    send({ text });
    inp.focus({ preventScroll: true });
  });

  // 換到目前這個角色的紀錄（她沒打開 LINE 時，他也要能傳進來）
  async function useCurrent() {
    const who = currentChar();
    if (!who) return null;
    if (!ch || ch.key !== who.key || !thread) { ch = who; thread = await loadThread(who.key); curStage = await stage.get(who.key); }
    return who;
  }
  const showing = () => !!screen.querySelector('.bp-line') && screen.closest('.bp-show');

  // 他先傳：kind = 'away'（她離開一陣子，補上這段時間他傳的）或 'idle'（她在但一陣子沒說話）
  async function himFirst(kind, gapMs = 0) {
    if (busy) return 0;
    const who = await useCurrent();
    if (!who) return 0;
    const cur = await stage.get(who.key);
    if (!stage.unlocked(cur, 'proactive')) return 0;
    const t = thread; const now = Date.now();
    if (t.mode === 'now') return 0; // 她在現實時間跟他聊，劇情先停著
    const today = data.today();
    const [notes, cal, memory] = await Promise.all([data.notes.all(who.key), data.cal.all(who.key), data.memory.all(who.key)]);
    const together = `先看正文最近的劇情：如果故事裡此刻 ${who.name} 和 ${who.user} 就在一起（同一個空間、看得到彼此、正在相處），他不會拿手機傳訊息給身邊的人——這時整則只寫 [[SKIP]]，其他什麼都不寫。`;
    const instr = kind === 'away'
      ? `【這次是他先傳的】${together}\n不在一起的話：從劇情判斷故事裡現在的時間，寫 ${who.name} 在這之後、兩人分開的時候，很自然傳給她的幾則 LINE：想到她、分享自己在做什麼、問她在幹嘛，內容符合劇情裡那個時間點和他正在做的事。\n請寫 1～3 則，每則一行，格式：HH:MM｜訊息（HH:MM 是劇情裡的時刻），照先後排。她都還沒回，所以不要寫成一來一往。`
      : `【這次是他先傳的】${together}\n不在一起的話：${who.name} 想到她，主動傳 LINE 給她。照劇情裡現在的時間和他正在做的事寫 1～2 則，每則一行，格式：HH:MM｜訊息（HH:MM 是劇情裡的時刻）。不要重複之前說過的話。`;
    let raw;
    try {
      raw = await generate(buildPrompt(who, t.msgs, {
        mode: 'story', nowSync: !!t.nowSync, stage: cur, proactive: instr, memory,
        notes: stage.unlocked(cur, 'notes') ? notes.filter((n) => !n.done).slice(0, 8) : [],
        cal: cal.filter((e) => e.date >= today).slice(0, 8),
      }));
    } catch { return 0; }
    if (/\[\[SKIP\]\]/i.test(raw)) return 0;
    let added = 0;
    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^(\d{1,2})[:：](\d{2})\s*[｜|]\s*(.+)$/);
      let text = (m ? m[3] : line).trim();
      text = parseReply(text, who).lines[0];
      if (!text) continue;
      // 排序用現實時間（一則隔一分鐘），畫面上顯示劇情時間
      const ts = now - (3 - added) * 60000;
      t.msgs.push({ id: uid(), me: false, text, ts, first: true, story: true, ...(m ? { st: `${m[1].padStart(2, '0')}:${m[2]}` } : {}) });
      if (++added >= (kind === 'away' ? 3 : 2)) break;
    }
    if (added) { t.msgs.sort((a, b) => a.ts - b.ts); await saveThread(who.key, t); if (showing() && view === 'room') refreshLog(); onUnread?.(unreadCount()); syncMain(); }
    return added;
  }

  // 劇情裡附來的訊息：現在送進聊天室
  async function deliver(lines) {
    const who = await useCurrent();
    if (!who) return 0;
    const now = Date.now();
    lines.forEach((text, i) => thread.msgs.push({ id: uid(), me: false, text, ts: now + i * 1000, fromStory: true, story: true }));
    await saveThread(who.key, thread);
    if (showing() && view === 'room') { thread.seen = Date.now(); refreshLog(); } else onUnread?.(unreadCount());
    syncMain();
    return lines.length;
  }

  // 還沒看的他的訊息（給通知、紅點用）
  async function unseen() {
    const who = await useCurrent();
    if (!who) return [];
    if (showing() && view === 'room') return [];
    return thread.msgs.filter((m) => !m.me && !m.err && !m.notice && m.ts > (thread.seen || 0)).map((m) => ({ ...m, who: who.name }));
  }

  // 她最後一次跟 LINE 有互動（傳或看）是什麼時候
  async function lastActive() {
    const who = await useCurrent();
    if (!who) return Date.now();
    const lastMine = [...thread.msgs].reverse().find((m) => m.me)?.ts || 0;
    return Math.max(lastMine, thread.seen || 0, thread.msgs[thread.msgs.length - 1]?.ts || 0);
  }
  async function unansweredRun() {
    const who = await useCurrent();
    if (!who) return 0;
    let n = 0;
    for (let i = thread.msgs.length - 1; i >= 0 && !thread.msgs[i].me; i--) if (!thread.msgs[i].err && !thread.msgs[i].notice) n++;
    return n;
  }

  return {
    open() { view = 'list'; render(); },
    openRoom() { view = 'room'; render(); },
    refresh: render,
    himFirst, deliver, unseen, lastActive, unansweredRun,
    forget() { ch = null; thread = null; }, // 換聊天或資料搬家之後，下次重讀
    get busy() { return !!busy; },
  };
}
