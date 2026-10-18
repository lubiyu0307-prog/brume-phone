// 霧語 Brume Phone · 介面樣品 v0.1
// 只有畫面：鎖定畫面、兩頁主畫面、換桌布、換照片小工具。App 點下去還不會開。

import { createLine, syncMain } from './line.js';
import { createNotes, createCalendar } from './apps.js';
import { createThreads } from './threads.js';
import { createHisPhone } from './hisphone.js';
import { createAlbum } from './album.js';
import { createIG } from './ig.js';
import { createGames } from './games.js';
import { createCall } from './call.js';
import { createLife, settings as lifeSet, LEVELS } from './life.js';
import * as push from './push.js';
import * as stage from './stage.js';
import { currentChar, ctx, lite, DATA_PREFIXES, uploadImage, dropImage, phoneOff } from './st.js';
import * as store from './store.js';
import * as data from './data.js';
import { createMusic, nowPlaying } from './music.js';

const KEY = 'brume-phone:v1';
const VERSION = '0.20.3';

// ---------- 除錯紀錄：手機在某些裝置上會不見，記下當時的畫面數字，設定裡可以複製給格看 ----------
const DBG_KEY = 'brume-phone:dbg';
const dbgT0 = Date.now();
function dbg(tag, extra) {
  try {
    const vv = window.visualViewport; const ov = document.getElementById('bp-overlay'); const ph = ov?.querySelector('.bp-phone');
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.height)]; };
    const row = {
      t: new Date().toTimeString().slice(0, 8), ms: Date.now() - dbgT0, tag, ...(extra ? { x: extra } : {}),
      vv: vv ? [Math.round(vv.width), Math.round(vv.height), Math.round(vv.offsetTop), Math.round(vv.pageTop || 0)] : null,
      win: [innerWidth, innerHeight, Math.round(scrollY)], open: !!ov?.classList.contains('bp-open'), ov: r(ov), ph: r(ph),
      // 最上面那條（時間、電池）蓋不住時查原因：安全區多高、最上面一排是誰、網頁有沒有延伸到狀態列底下
      safe: (() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);width:1px;visibility:hidden'; document.body.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return Math.round(h); })(),
      top: (() => { const e = document.elementFromPoint(innerWidth / 2, 2); return e ? `${e.tagName}.${String(e.className || '').slice(0, 24)}` : null; })(),
      tc: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content).join('|'),
      meta: document.querySelector('meta[name=viewport]')?.content?.replace(/\s+/g, '') || '', pwa: !!navigator.standalone,
      html: getComputedStyle(document.documentElement).position, act: document.activeElement?.className?.toString().slice(0, 30) || document.activeElement?.tagName,
    };
    const a = JSON.parse(localStorage.getItem(DBG_KEY) || '[]'); a.push(row);
    localStorage.setItem(DBG_KEY, JSON.stringify(a.slice(-80)));
  } catch { /* 記不了就算了 */ }
}
dbg('boot', VERSION);

const ICON = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>',
  line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 4C6.8 4 3 7.2 3 11.1c0 3.5 3 6.3 7 6.9l-.6 2.6c-.1.4.3.6.6.4 2.6-1.6 5.9-3.8 7.4-5.6 1.4-1.3 2.6-2.6 2.6-4.3C21 7.2 17.2 4 12 4z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/></svg>',
  threads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M16.8 8.6C16 6 14.2 4.5 11.8 4.5 8 4.5 5.5 7.6 5.5 12s2.5 7.5 6.3 7.5c3 0 5.3-1.6 5.3-4.3 0-2.4-2-3.7-4.8-3.7-2.2 0-3.6 1-3.6 2.4 0 1.3 1.1 2.2 2.6 2.2 2.4 0 3.6-1.8 3.6-5"/></svg>',
  album: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 11v3M6 12.5h3"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="17.5" cy="13.8" r=".9" fill="currentColor" stroke="none"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
  torch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 3h8v4l-2 3v11h-4V10L8 7z"/><path d="M12 13v2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12L9.5 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l10.5-6z"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  wifi: '<svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM3.8 7.2a6 6 0 0 1 8.4 0l-1.2 1.2a4.3 4.3 0 0 0-6 0zM1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.2 1.2a7.9 7.9 0 0 0-11.2 0z"/></svg>',
  battery: '<svg viewBox="0 0 27 12" fill="none" stroke="currentColor"><rect x=".5" y=".5" width="23" height="11" rx="3.2" opacity=".5"/><rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M25 4.2v3.6" stroke-width="1.4" stroke-linecap="round" opacity=".5"/></svg>',
};

// 兩頁主畫面。w2＝2×2 小工具、w4＝4×2 小工具，其他是 App
const PAGES = [
  [
    { w: 'w4', kind: 'calendar' },
    { w: 'w2', kind: 'photo', slot: 'p1' },
    { app: 'ig', name: 'Instagram' },
    { app: 'threads', name: 'Threads' },
    { app: 'album', name: '相本' },
    { app: 'camera', name: '快照' },
    { app: 'music', name: '音樂' },
    { app: 'game', name: '小遊戲' },
    { w: 'w2', kind: 'photo', slot: 'p2' },
    { app: 'notes', name: '便條' },
    { app: 'calendar', name: '行事曆' },
  ],
  [
    { w: 'w2', kind: 'music' },
    { w: 'w2', kind: 'photo', slot: 'p3' },
    { w: 'w4', kind: 'photo', slot: 'p4' },
    { app: 'settings', name: '設定' },
  ],
];
const DOCK = [
  { app: 'phone', name: '電話' },
  { app: 'line', name: 'LINE' },
  { app: 'camera', name: '快照' },
  { app: 'music', name: '音樂' },
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}
let state = load();

// 桌布和桌面照片：存在酒館伺服器上（store 的 desk），手機和電腦開同一個酒館看到同一個桌面。
// 0.18.36 以前存在各自瀏覽器的 state.wall／state.photos，第一次打開時搬上去
const DESK = 'desk';
let desk = { wall: state.wall || '', photos: { ...(state.photos || {}) } };

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const pad = (n) => String(n).padStart(2, '0');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function calendarWidget() {
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let cells = WEEK.map((w) => `<span class="bp-dow">${w}</span>`).join('');
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let i = 1; i <= days; i++) cells += `<span class="${i === d ? 'bp-today' : ''}">${i}</span>`;
  const mon = now.toLocaleString('en', { month: 'short' }).toUpperCase();
  return `<div class="bp-widget bp-w4 bp-cal" data-open="calendar">
    <div class="bp-cal-big"><div class="bp-cal-mon">${mon}.</div><div class="bp-cal-day">${d}</div></div>
    <div class="bp-cal-grid">${cells}</div></div>`;
}

function photoWidget(w, slot) {
  const src = desk.photos?.[slot];
  const inner = src ? '' : `<div class="bp-photo-empty"><div>${ICON.add}點一下放照片</div></div>`;
  const bg = src ? ` style="background-image:url('${src}')"` : '';
  return `<div class="bp-widget bp-${w} bp-photo" data-slot="${slot}"${bg}>${inner}</div>`;
}

function musicWidget() {
  return `<div class="bp-widget bp-w2 bp-music" data-open="music">
    <div class="bp-music-cover">${ICON.music}</div>
    <div><div class="bp-music-t">還沒有歌</div><div class="bp-music-a">讓他推薦一首吧</div></div>
    <div class="bp-music-ctl"><i data-mw="prev">${ICON.prev}</i><i data-mw="toggle">${ICON.play}</i><i data-mw="next">${ICON.next}</i></div></div>`;
}

// 還沒準備好的 App：圖示變淡，點了只跳提示（10/15 露比說先鎖起來）
const SOON = new Set(['phone', 'game']);

function appTile(a) {
  return `<div class="bp-app${SOON.has(a.app) ? ' bp-app-soon' : ''}" data-open="${a.app}"><div class="bp-icon">${ICON[a.app]}</div><div class="bp-label">${a.name}</div></div>`;
}

function tile(t) {
  if (t.app) return appTile(t);
  if (t.kind === 'calendar') return calendarWidget();
  if (t.kind === 'music') return musicWidget();
  return photoWidget(t.w, t.slot);
}

function build() {
  const overlay = $(`<div id="bp-overlay"><div class="bp-phone">
    <div class="bp-wall"></div>
    <div class="bp-status"><span class="bp-clock"></span><span class="bp-sys">${ICON.wifi}${ICON.battery}</span></div>
    <div class="bp-home">
      <div class="bp-pages">${PAGES.map((p) => `<div class="bp-page">${p.map(tile).join('')}</div>`).join('')}</div>
      <div class="bp-dots">${PAGES.map((_, i) => `<i class="${i ? '' : 'bp-on'}"></i>`).join('')}</div>
      <div class="bp-dock">${DOCK.map(appTile).join('')}</div>
      <div class="bp-homebar" title="收起手機"><i></i></div>
    </div>
    <div class="bp-lock">
      <div class="bp-lock-date"></div>
      <div class="bp-lock-time"></div>
      <div class="bp-notifs"></div>
      <div class="bp-lock-bottom">
        <div class="bp-lock-row">
          <div class="bp-weather"><b>☁︎ 24°</b><br>多雲<br>高 27° 低 21°</div>
          <div class="bp-lock-chips"><div class="bp-round" data-act="music" title="音樂">${ICON.music}</div></div>
        </div>
        <div class="bp-lock-tools"><div class="bp-round bp-swap" data-act="his" title="偷看他的手機">${ICON.swap}</div><div class="bp-round" data-act="snap" title="快照">${ICON.camera}</div></div>
        <div class="bp-hint">往上滑或點一下解鎖</div>
      </div>
    </div>
    <div class="bp-appscreen"></div>
    <div class="bp-his"></div>
    <div class="bp-yt"></div>
    <div class="bp-close" title="收起手機">${ICON.x}</div>
    <div class="bp-toast"></div>
    <div class="bp-sheet">
      <h3>設定</h3>
      <div class="bp-setrow"><span>你們的關係</span><div class="bp-seg" data-seg="stage">${stage.STAGES.map((x) => `<b data-act="stage" data-v="${x.id}">${x.name}</b>`).join('')}</div></div>
      <p class="bp-sheet-note">有些功能等關係到了才打開：曖昧開始他會主動找妳，交往之後有陪睡模式，同居之後有冰箱門。他的手機隨時都可以偷看。劇情裡關係往前一步時，手機會問妳要不要改。</p>
      <div class="bp-setrow"><span>他主動的程度</span><div class="bp-seg" data-seg="level">${Object.entries(LEVELS).map(([k, v]) => `<b data-act="level" data-v="${k}">${v.name}</b>`).join('')}</div></div>
      <button data-act="bridge" class="bp-switchrow">劇情接手機<i></i></button>
      <p class="bp-sheet-note">開著：正文裡你們分開、約好下次的時候，他之後會自己傳 LINE 或發脆，過幾分鐘手機才響。</p>
      <button data-act="push" class="bp-pushbtn">開啟通知</button>
      <p class="bp-sheet-note bp-pushnote">酒館關著、手機鎖著，他傳 LINE 也會跳通知。</p>
      <div class="bp-setrow bp-pushrow"><span>訊息照什麼時間寫</span><div class="bp-seg" data-seg="pmode">${[['story', '照劇情'], ['real', '照現實']].map(([v, n]) => `<b data-act="pmode" data-v="${v}">${n}</b>`).join('')}</div></div>
      <p class="bp-sheet-note bp-pushrow">照劇情：他照故事裡現在幾點、人在哪寫。照現實：照妳收到通知的那一刻寫，早上收到早安、晚上問妳到家了沒。</p>
      <div class="bp-setrow bp-pushrow"><span>他一天最多傳</span><div class="bp-seg" data-seg="pmax">${[1, 2, 3, 5].map((n) => `<b data-act="pmax" data-v="${n}">${n} 次</b>`).join('')}</div></div>
      <div class="bp-setrow bp-pushrow"><span>不吵妳的時段</span><div class="bp-seg" data-seg="pquiet">${[[23, 7], [1, 9], [3, 11]].map(([f, t]) => `<b data-act="pquiet" data-v="${f}-${t}">${f}–${t} 點</b>`).join('')}</div></div>
      <div class="bp-setrow"><span>護眼模式</span><div class="bp-seg" data-seg="eye">${[['off', '關'], ['on', '開'], ['auto', '晚上自動']].map(([k, n]) => `<b data-act="eye" data-v="${k}">${n}</b>`).join('')}</div></div>
      <p class="bp-sheet-note">畫面暗一點、偏暖色，白底不刺眼。晚上自動：晚上七點到早上七點自動打開。</p>
      <button data-act="lite" class="bp-switchrow">省 token 模式<i></i></button>
      <p class="bp-sheet-note">開著：只送角色卡、被叫到的世界書和正文最後幾則，比正文一次少很多。關掉：送整份預設和整段正文，跟正文一樣貴，但他看得最完整。傳照片給他時一律走完整的。</p>
      <button data-act="mig-yes" class="bp-migbtn" hidden>把之前的紀錄搬進這個聊天</button>
      <button data-act="his">偷看他的手機</button>
      <button data-act="wall">換桌布</button>
      <button data-act="wall-reset">用回預設桌布</button>
      <button data-act="photos-reset">清掉小工具照片</button>
      <button data-act="homeicon">放到手機桌面</button>
      <button data-act="appicon">換桌面圖示的照片</button>
      <div class="bp-setrow"><span>開機畫面的大字</span><input class="bp-splash-in" data-splash="title" maxlength="20" placeholder="Brume"></div>
      <div class="bp-setrow"><span>開機畫面的小字</span><input class="bp-splash-in" data-splash="line" maxlength="40" placeholder="霧語"></div>
      <button data-act="splashbg">換開機畫面的照片</button>
      <button data-act="splashprev">看一下開機畫面</button>
      <button data-act="splashreset">開機畫面用回預設</button>
      <p class="bp-sheet-note">桌面多一個「Brume」圖示，點了直接打開上次那個角色的手機，不用先開酒館、選角色。圖示可以換成妳喜歡的照片（換好再按一次「放到手機桌面」；已經放過的要先把舊的刪掉）。從 Brume 打開時，酒館載入那幾秒會先蓋一張開機畫面，照片和字都可以自己換。</p>
      <button data-act="cardoff" class="bp-danger">這張卡不用小手機</button>
      <p class="bp-sheet-note">古風、奇幻這類沒有手機的故事用：手機按鈕收起來、劇情不接手機、他也不會主動傳。要再打開，從輸入框左邊的魔杖選單點霧語。</p>
      <button data-act="dbg">複製除錯紀錄（給格看）</button>
      <button class="bp-cancel" data-act="close">完成</button>
      <div class="bp-ver">霧語 Brume Phone v${VERSION}</div>
    </div>
    <input type="file" accept="image/*" hidden>
  </div></div>`);
  // 掛在 <html> 底下，不放進 <body>：手機版酒館和一些主題會在 body 裡加 transform／filter，
  // 那會把 position:fixed 關在一個小框裡（v0.1.1 在 iPhone 上只剩半截就是這樣）
  document.documentElement.appendChild(overlay);
  // 鋪滿看得到的範圍。外層如果有 transform（酒館的 <html>、Claude App 的預覽框都有），
  // fixed 的原點就不是螢幕左上角，所以放好之後量一次實際位置，差多少補多少
  const fit = () => {
    const vv = window.visualViewport;
    const W = Math.round(vv ? vv.width : innerWidth); const H = Math.round(vv ? vv.height : innerHeight);
    // 看得到的範圍在網頁座標裡的左上角。用 pageTop − scrollY，不用 offsetTop：
    // iPhone（iOS 26）彈出鍵盤時整頁捲下去 404，offsetTop 也報 404，但其實看得到的範圍就在最上面，
    // 照 offsetTop 擺會把手機擺到鍵盤後面（0.11.1 的除錯紀錄抓到的）
    const X = Math.round(vv ? (vv.pageLeft != null ? vv.pageLeft - scrollX : vv.offsetLeft) : 0);
    const Y = Math.round(vv ? (vv.pageTop != null ? vv.pageTop - scrollY : vv.offsetTop) : 0);
    overlay.style.setProperty('--bp-w', `${W}px`); overlay.style.setProperty('--bp-h', `${H}px`);
    overlay.style.left = `${X}px`; overlay.style.top = `${Y}px`;
    overlay.style.setProperty('--bp-left', `${X}px`); overlay.style.setProperty('--bp-top', `${Y}px`);
    if (!overlay.classList.contains('bp-open')) return; // 沒打開時量不到
    const o = overlay.getBoundingClientRect();
    overlay.style.left = `${2 * X - o.left}px`; overlay.style.top = `${2 * Y - o.top}px`;
    const ph = overlay.querySelector('.bp-phone');
    if (getComputedStyle(ph).position === 'fixed') {
      const r = ph.getBoundingClientRect();
      overlay.style.setProperty('--bp-left', `${2 * X - r.left}px`); overlay.style.setProperty('--bp-top', `${2 * Y - r.top}px`);
    }
  };
  fit();
  // iPhone 彈出鍵盤時：先縮高度（resize），再把看得到的範圍往下挪（visualViewport 的 scroll，不是網頁的 scroll）。
  // 只跟 resize 的話，手機會停在舊位置、整個被推到畫面外。
  // 手機版酒館在 resize 時也會把 <html> 暫時改成 fixed 一個畫格，那一格量到的位置是歪的，
  // 所以等兩個畫格再量一次，鍵盤動畫跑完再量一次。
  let fitTimer = 0;
  const refit = () => {
    fit();
    requestAnimationFrame(() => requestAnimationFrame(fit));
    clearTimeout(fitTimer); fitTimer = setTimeout(fit, 350);
  };
  let vpChanged = 0; // 畫面剛動過的時間：這段時間內點到外框不算「點外面」
  const seen = (tag, f) => (e) => { vpChanged = Date.now(); if (overlay.classList.contains('bp-open')) { dbg(tag); setTimeout(() => dbg(tag + '+400'), 400); } f(e); };
  addEventListener('resize', seen('resize', refit));
  addEventListener('scroll', seen('scroll', fit), { passive: true }); // 外層有 transform 時，網頁一捲手機會跟著跑
  window.visualViewport?.addEventListener('resize', seen('vv-resize', refit));
  window.visualViewport?.addEventListener('scroll', seen('vv-scroll', fit));
  overlay.addEventListener('focusin', seen('focusin', refit));
  overlay.addEventListener('focusout', seen('focusout', () => setTimeout(refit, 50)));
  addEventListener('pagehide', () => dbg('pagehide'));
  document.addEventListener('visibilitychange', () => dbg('visibility', document.visibilityState));

  const phone = overlay.querySelector('.bp-phone');
  const lock = overlay.querySelector('.bp-lock');
  const pages = overlay.querySelector('.bp-pages');
  const sheet = overlay.querySelector('.bp-sheet');
  const file = overlay.querySelector('input[type=file]');
  const toast = overlay.querySelector('.bp-toast');
  let pickTarget = null;

  const applyWall = () => {
    overlay.querySelector('.bp-wall').style.backgroundImage = desk.wall ? `url('${desk.wall}')` : '';
  };
  applyWall();

  // 桌面照角色卡分：每張卡有自己的桌布和照片（desk:角色），沒設過的卡是空白的。
  // desk 是 0.18.37 搬上伺服器時的那份，只在沒開角色的時候用
  // 跟伺服器對一次桌面；伺服器上還沒有、這台有舊的就傳上去
  let deskSeen = JSON.stringify(desk);
  let shared = null; // 共用那份，換照片時用來判斷舊圖還有沒有別的卡在用
  const deskKey = () => { const c = currentChar(); return c ? `${DESK}:${c.charKey}` : DESK; };
  const loadDesk = async () => {
    const key = deskKey();
    shared = await store.get(DESK);
    let d = key === DESK ? shared : await store.get(key);
    if (!d && !shared && (state.wall || Object.keys(state.photos || {}).length)) {
      d = { wall: '', photos: {} };
      if (state.wall) d.wall = (await uploadImage(state.wall)) || '';
      for (const [k, v] of Object.entries(state.photos || {})) { const u = await uploadImage(v); if (u) d.photos[k] = u; }
      if (d.wall || Object.keys(d.photos).length) {
        await store.set(key, d); if (key === DESK) shared = d; // 這台還有 0.18.36 以前的舊桌面：搬給現在開的這張卡
        delete state.wall; delete state.photos; save(state);
      } else d = null;
    }
    d ||= { wall: '', photos: {} };
    if (shared && (state.wall || state.photos)) { delete state.wall; delete state.photos; save(state); } // 伺服器上已經有了，這台的舊副本不要了
    desk = { wall: d.wall || '', photos: { ...(d.photos || {}) } };
    const now = JSON.stringify(desk);
    if (now === deskSeen) return;
    deskSeen = now; applyWall(); rebuild();
  };
  const saveDesk = async () => { deskSeen = JSON.stringify(desk); const key = deskKey(); await store.set(key, desk); if (key === DESK) shared = desk; };
  // 換掉的舊圖：共用那份還在用的不刪（這張卡是從共用那份改的）
  const dropOld = (url) => { if (!url) return; if (shared && shared !== desk && (shared.wall === url || Object.values(shared.photos || {}).includes(url))) return; dropImage(url); };
  window.addEventListener('bp-store-late', (e) => { if (String(e.detail).startsWith(DESK)) loadDesk(); });

  const tick = () => {
    const n = new Date();
    const hm = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    overlay.querySelector('.bp-clock').textContent = hm;
    overlay.querySelector('.bp-lock-time').textContent = hm;
    overlay.querySelector('.bp-lock-date').textContent = `${n.getMonth() + 1}月${n.getDate()}日 星期${WEEK[n.getDay()]}`;
  };
  tick(); setInterval(tick, 10000);

  let toastTimer;
  // 別的地方要提醒玩家的事（例如 GPT 沒看到證件照）：跳一次提示，同一句十分鐘內不重複
  const hinted = new Map();
  window.addEventListener('bp-hint', (e) => { const t = String(e.detail || ''); if (!t || Date.now() - (hinted.get(t) || 0) < 600e3) return; hinted.set(t, Date.now()); setTimeout(() => say(t), 1200); });
  const say = (msg) => {
    toast.textContent = msg; toast.classList.add('bp-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('bp-show'), 1600);
  };

  // 解鎖：點一下或往上滑
  let y0 = null;
  lock.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  lock.addEventListener('pointerup', (e) => {
    if (y0 === null) return;
    const dy = y0 - e.clientY; y0 = null;
    if (e.target.closest('[data-act]')) return; // 點的是鎖定畫面上的按鈕，不是要解鎖
    if (dy > 40 || Math.abs(dy) < 8) { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); }
  });

  // 頁面圓點
  pages.addEventListener('scroll', () => {
    const i = Math.round(pages.scrollLeft / pages.clientWidth);
    overlay.querySelectorAll('.bp-dots i').forEach((d, k) => d.classList.toggle('bp-on', k === i));
  }, { passive: true });

  // 護眼：關、開、晚上自動（19:00～07:00）
  function applyEye() {
    const h = new Date().getHours();
    const on = state.eye === 'on' || (state.eye === 'auto' && (h >= 19 || h < 7));
    phone.classList.toggle('bp-eye', on);
  }
  applyEye();
  setInterval(applyEye, 60000);

  const showLite = () => sheet.querySelector('[data-act="lite"] i').classList.toggle('on', lite.get());
  async function showSettings() {
    showLite();
    const c = currentChar(); const cur = c ? await stage.get(c.key) : 'meet';
    sheet.querySelectorAll('[data-act="stage"]').forEach((b) => b.classList.toggle('on', b.dataset.v === cur));
    sheet.querySelectorAll('[data-act="level"]').forEach((b) => b.classList.toggle('on', b.dataset.v === lifeSet.get().level));
    sheet.querySelector('[data-act="bridge"] i').classList.toggle('on', lifeSet.get().bridge);
    sheet.querySelector('.bp-migbtn').hidden = !(await hasOldData());
    sheet.querySelectorAll('[data-act="eye"]').forEach((b) => b.classList.toggle('on', b.dataset.v === (state.eye || 'off')));
    showPush();
    const sp = splashConf(); sheet.querySelectorAll('.bp-splash-in').forEach((i) => { i.value = sp[i.dataset.splash] || ''; });
  }
  sheet.addEventListener('change', (e) => { const i = e.target.closest('.bp-splash-in'); if (i) { setSplash({ [i.dataset.splash]: i.value.trim() }); say('開機畫面改好了'); } });

  // 通知：設定頁一打開就先檢查好（iPhone 只在按下去那一刻讓網頁跳出允許通知的視窗，等檢查就來不及）
  let pushPre = null;
  async function showPush() {
    const btn = sheet.querySelector('[data-act="push"]'); const note = sheet.querySelector('.bp-pushnote');
    const ps = push.pushSet.get();
    sheet.querySelectorAll('[data-act="pmax"]').forEach((b) => b.classList.toggle('on', +b.dataset.v === ps.max));
    sheet.querySelectorAll('[data-act="pmode"]').forEach((b) => b.classList.toggle('on', b.dataset.v === ps.mode));
    sheet.querySelectorAll('[data-act="pquiet"]').forEach((b) => b.classList.toggle('on', b.dataset.v === `${ps.quietFrom}-${ps.quietTo}`));
    const on = push.deviceOn();
    btn.textContent = on ? '關掉這台的通知' : '開啟通知';
    sheet.querySelectorAll('.bp-pushrow').forEach((r) => { r.hidden = !ps.on; });
    if (on) { note.textContent = '這台會收到通知。他會挑妳沒在玩的時候傳，一天不超過下面的次數，不吵妳的時段不傳。'; pushPre = null; return; }
    note.textContent = '檢查中⋯';
    pushPre = await push.precheck();
    note.textContent = pushPre.ready ? '酒館關著、手機鎖著，他傳 LINE 也會跳通知。按上面的按鈕，跳出來的視窗選「允許」。' : pushPre.why;
  }
  async function togglePush() {
    if (push.deviceOn()) { await push.disable(); say('這台的通知關掉了'); showPush(); return; }
    if (!pushPre?.ready) { say(pushPre?.why ? '還差一步，看按鈕下面的說明' : '還在檢查，等一下再按'); return; }
    const note = sheet.querySelector('.bp-pushnote');
    try {
      const r = await push.enable(pushPre.status);
      if (!r.ok) { note.textContent = r.why; return; }
      const p = push.platform();
      say(r.tested ? '通知打開了，應該馬上會收到一則測試' : '通知打開了');
      await showPush();
      if (p.android) note.textContent += ' 安卓提醒：小米、OPPO、華為這些手機很會關掉背景，到「設定 → 電池」把 Chrome 設成「不受限制」，通知才不會晚到。';
      if (p.desktop) note.textContent += ' 電腦要瀏覽器開著才收得到。';
    } catch (err) { note.textContent = `沒有開成功：${err.message || err}。重新整理後再試一次，還是不行就複製除錯紀錄給格。`; dbg('push-fail', String(err?.message || err)); }
  }

  // 點圓點跳頁
  const goPage = (i) => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' });
  overlay.querySelectorAll('.bp-dots i').forEach((d, i) => d.addEventListener('click', () => goPage(i)));
  const curPage = () => Math.round(pages.scrollLeft / pages.clientWidth);

  // 滑鼠滾輪也能換頁：上下滾而且這一頁本身不用捲的時候，往下＝下一頁
  let wheelLock = 0;
  pages.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // 觸控板左右滑交給瀏覽器
    const page = pages.children[curPage()];
    if (page && page.scrollHeight > page.clientHeight + 2) return; // 這頁還能上下捲
    e.preventDefault();
    if (Date.now() - wheelLock < 600 || Math.abs(e.deltaY) < 8) return;
    wheelLock = Date.now();
    goPage(Math.max(0, Math.min(PAGES.length - 1, curPage() + (e.deltaY > 0 ? 1 : -1))));
  }, { passive: false });
  let lastDragEnd = 0;

  // 滑鼠拖曳換頁（手指本來就能滑，這是給電腦用的）
  let drag = null; let dragged = false;
  pages.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    drag = { x: e.clientX, left: pages.scrollLeft }; dragged = false;
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) { dragged = true; pages.style.scrollSnapType = 'none'; pages.scrollLeft = drag.left - dx; }
  });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; const from = Math.round(drag.left / pages.clientWidth);
    drag = null; pages.style.scrollSnapType = ''; if (dragged) lastDragEnd = Date.now();
    if (dragged) goPage(Math.max(0, Math.min(PAGES.length - 1, from + (dx < -40 ? 1 : dx > 40 ? -1 : 0))));
  });

  // 點擊
  phone.addEventListener('click', async (e) => {
    if (dragged) { dragged = false; return; }
    if (e.target.closest('.bp-appscreen, .bp-his')) return; // App 裡面的點擊由各個 App 自己處理
    const slot = e.target.closest('[data-slot]');
    if (slot) { pickTarget = slot.dataset.slot; file.click(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'push') { togglePush(); return; } // 放最前面：要在點擊當下直接請求通知權限，前面不能有 await
      if (a === 'pmode') { push.pushSet.set({ mode: act.dataset.v }); const c = currentChar(); if (c) push.queue.cancel(c.key); showPush(); say(act.dataset.v === 'real' ? '之後照現實時間寫' : '之後照劇情時間寫'); return; } // 已經排好的照舊寫法，作廢重排
      if (a === 'appicon') { pickTarget = 'appicon'; file.click(); return; }
      if (a === 'splashbg') { pickTarget = 'splashbg'; file.click(); return; }
      if (a === 'splashprev') { try { showSplash('preview'); } catch (err) { dbg('splash-err', String(err?.message || err)); } setTimeout(hideSplash, 2600); return; }
      if (a === 'splashreset') { setSplash(null); sheet.querySelectorAll('.bp-splash-in').forEach((i) => { i.value = ''; }); say('開機畫面用回預設了'); return; }
      if (a === 'homeicon') {
        const icon = ctx()?.extensionSettings?.['brume-phone']?.appIcon;
        const page = new URL('app.html', import.meta.url); if (icon) page.searchParams.set('icon', icon);
        const u = page.href;
        try { await navigator.clipboard.writeText(u); } catch { /* 複製不了就算了 */ }
        window.open(u, '_blank');
        say('照新頁面上的步驟加到桌面；沒跳出來的話，網址已經複製好了，貼到 Safari 或 Chrome 打開');
        return;
      }
      if (a === 'pmax') { push.pushSet.set({ max: +act.dataset.v }); showPush(); return; }
      if (a === 'pquiet') { const [f, t] = act.dataset.v.split('-').map(Number); push.pushSet.set({ quietFrom: f, quietTo: t }); showPush(); return; }
      if (a === 'wall') { pickTarget = 'wall'; file.click(); }
      if (a === 'wall-reset') { const old = desk.wall; desk = { ...desk, wall: '' }; saveDesk(); dropOld(old); applyWall(); say('用回預設桌布了'); }
      if (a === 'photos-reset') { const old = Object.values(desk.photos); desk = { ...desk, photos: {} }; saveDesk(); old.forEach(dropOld); rebuild(); say('照片清掉了'); }
      if (a === 'close') sheet.classList.remove('bp-show');
      if (a === 'cardoff') {
        const ch = currentChar(); if (!ch) return;
        if (!confirm(`${ch.name} 這張卡不用小手機？\n手機按鈕會收起來，資料都還在。`)) return;
        phoneOff.set(ch.charKey, true); sheet.classList.remove('bp-show'); close('cardoff'); life.refreshPrompt(); syncOff();
      }
      if (a === 'dbg') {
        // 10/18：整包 JSON 貼進 Discord 會被字數限制切掉，只剩尾巴；改成一列一行的精簡版，固定不變的欄位放最上面一次
        let rows = []; try { rows = JSON.parse(localStorage.getItem(DBG_KEY) || '[]'); } catch { /* 讀不到 */ }
        const last = rows[rows.length - 1] || {};
        const os = (navigator.userAgent.match(/OS (\d+[_.]\d+)/) || [])[1] || navigator.userAgent.slice(0, 40);
        const n = (v) => (Array.isArray(v) ? v.join(',') : '-');
        const line = (r) => {
          const s = [r.t, r.tag + (r.x ? `(${String(r.x).slice(0, 20)})` : ''), `vv${n(r.vv)}`, `win${n(r.win)}`];
          if (r.sh) s.push(`sh${n(r.sh)}`); else s.push(`ov${n(r.ov)}`, `ph${n(r.ph)}`, r.open ? 'open' : 'closed');
          if (r.doc) s.push(`doc${n(r.doc)}`);
          s.push(r.html, r.act ? `act=${String(r.act).slice(0, 8)}` : '');
          return s.filter(Boolean).join(' ');
        };
        let txt = `Brume Phone v${VERSION} iOS${os} pwa=${last.pwa} safe=${last.safe} tc=${last.tc || ''}\nmeta=${last.meta || ''}\n`;
        txt += rows.slice(-20).map(line).join('\n');
        try { await navigator.clipboard.writeText(txt); say('複製好了，貼給格'); } catch {
          sheet.insertAdjacentHTML('beforeend', '<textarea class="bp-dbgbox" readonly></textarea>');
          const box = sheet.querySelector('.bp-dbgbox'); box.value = txt; box.select(); say('自動複製不行，全選這格長按複製');
        }
      }
      if (a === 'his') {
        const c = currentChar(); const cur = c ? await stage.get(c.key) : 'meet';
        if (!stage.unlocked(cur, 'his')) { say(`${stage.needFor('his')}之後才能偷看他的手機`); return; }
        sheet.classList.remove('bp-show'); his.open();
      }
      if (a === 'stage') { const c = currentChar(); if (!c) { say('先在酒館選一個角色'); return; } await stage.set(c.key, act.dataset.v); showSettings(); life.refreshPrompt(); syncMain(); say(`關係改成「${stage.name(act.dataset.v)}」了`); }
      if (a === 'eye') { state.eye = act.dataset.v; save(state); applyEye(); showSettings(); }
      if (a === 'level') { lifeSet.set({ level: act.dataset.v }); showSettings(); }
      if (a === 'bridge') { lifeSet.set({ bridge: !lifeSet.get().bridge }); showSettings(); life.refreshPrompt(); }
      if (a === 'snap') { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); openApp(snap); }
      if (a === 'music') { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); openApp(music); }
      if (a === 'notif') { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); openLineRoom(); }
      if (a === 'hint-yes') { const h = overlay.querySelector('.bp-hintsheet'); await stage.set(h.dataset.key, h.dataset.v); h.remove(); life.refreshPrompt(); syncMain(); say(`關係改成「${stage.name(h.dataset.v)}」了`); }
      if (a === 'hint-no') overlay.querySelector('.bp-hintsheet')?.remove();
      if (a === 'mig-yes') {
        const c = currentChar();
        if (c && c.key !== c.charKey) {
          for (const pre of DATA_PREFIXES) {
            const v = await store.get(`${pre}:${c.charKey}`).catch(() => null);
            if (v != null) await store.set(`${pre}:${c.key}`, v).catch(() => {});
          }
          stage.forget(c.key); line.forget();
          try { localStorage.setItem(`brume-phone:migrated:${c.charKey}`, c.key); } catch { /* 存不了 */ }
          say('之前的紀錄搬進這個聊天了'); life.refreshPrompt(); syncMain(); refreshNotices(); calDots(); showSettings();
        }
      }
      if (a === 'lite') { lite.set(!lite.get()); showLite(); say(lite.get() ? '省 token 模式開了' : '改用完整模式'); }
      return;
    }
    const mw = e.target.closest('[data-mw]');
    if (mw) {
      if (mw.dataset.mw === 'toggle') nowPlaying.toggle(); else nowPlaying.skip(mw.dataset.mw === 'next' ? 1 : -1);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) {
      if (open.dataset.open === 'settings') { showSettings(); sheet.classList.add('bp-show'); return; }
      if (open.dataset.open === 'line') { openApp(line); return; }
      if (open.dataset.open === 'music') { openApp(music); return; }
      if (open.dataset.open === 'notes') {
        const c = currentChar(); const cur = c ? await stage.get(c.key) : 'meet';
        if (!stage.unlocked(cur, 'notes')) { say(`冰箱門要${stage.needFor('notes')}之後才有`); return; }
        openApp(notes); return;
      }
      if (open.dataset.open === 'calendar') { openApp(calendar); return; }
      if (open.dataset.open === 'threads') { openApp(threads); return; }
      if (open.dataset.open === 'album') { openApp(album); return; }
      if (open.dataset.open === 'ig') { openApp(ig); return; }
      if (SOON.has(open.dataset.open)) { say('這個功能還在準備中，之後開放 ☁︎'); return; }
      if (open.dataset.open === 'game') { openApp(games); return; }
      if (open.dataset.open === 'phone') { openApp(callApp); return; }
      if (open.dataset.open === 'camera') { openApp(snap); return; }
      say('這個 App 還在做 ☁︎');
      return;
    }
    if (e.target.closest('.bp-homebar')) close('homebar'); else if (e.target.closest('.bp-close')) close('x');
  });

  // 選照片：縮到 1080 寬再存，免得塞爆瀏覽器空間
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = '';
    if (!f || !pickTarget) return;
    const target = pickTarget;
    if (target === 'appicon') { await setAppIcon(f); return; }
    if (target === 'splashbg') {
      say('照片放上去中⋯');
      const u = await uploadImage(await shrink(f, 1290));
      if (!u) { say('照片存不上去，等一下再試試'); return; }
      setSplash({ bg: u }); say('開機畫面的照片換好了，按「看一下開機畫面」看看'); return;
    }
    say('照片放上去中⋯');
    const url = await uploadImage(await shrink(f, target === 'wall' ? 1290 : 900));
    if (!url) { say('照片存不上去，等一下再試試'); return; }
    const old = target === 'wall' ? desk.wall : desk.photos[target];
    desk = { wall: desk.wall, photos: { ...desk.photos } }; // 不要改到共用那份
    if (target === 'wall') desk.wall = url; else desk.photos[target] = url;
    await saveDesk();
    if (old && old !== url) dropOld(old);
    if (target === 'wall') { applyWall(); say('桌布換好了'); } else { rebuild(); say('放好了'); }
  });

  // App 畫面：從右邊滑進來，蓋在主畫面上
  const appScreen = overlay.querySelector('.bp-appscreen');
  // 先清掉上一個 App 的畫面：App 要等資料（有時候等伺服器）才畫得出來，不清的話會先看到上一個 App 停幾秒
  const openApp = (app) => { music?.leave(); appScreen.innerHTML = '<div class="bp-app-wait"><i></i><i></i><i></i></div>'; app.open(); appScreen.classList.add('bp-show'); phone.classList.add('bp-app-open'); };
  const closeApp = () => { if (callApp?.inCall) callApp.hang(); appScreen.classList.remove('bp-show'); phone.classList.remove('bp-app-open'); music?.leave(); refreshNotices?.(); };
  appScreen.addEventListener('bp-home', closeApp);
  const line = createLine({ screen: appScreen, say, onUnread: (n) => setBadge('line', n), onData: () => calDots() });
  const notes = createNotes({ screen: appScreen, say });
  const calendar = createCalendar({ screen: appScreen, say });
  const threads = createThreads({ screen: appScreen, say });
  const ig = createIG({ screen: appScreen, say });
  const album = createAlbum({ screen: appScreen, say, onShare: async (img, text) => { await line.share({ text: text || '', img }); openApp(line); line.openRoom(); }, onIG: (img, hint, id) => ig.postPhoto(img, hint, id) });
  const games = createGames({ screen: appScreen, say });
  const callApp = createCall({ screen: appScreen, say });
  const snap = { open: () => album.open('snap') };
  const his = createHisPhone({ host: overlay.querySelector('.bp-his'), say, onExit: () => say('還給他了，他沒發現') });
  const openLineRoom = () => { openApp(line); line.openRoom(); };
  setTimeout(() => push.syncIfEnabled(), 6000); // 每次打開酒館檢查一次訂閱還在不在、鑰匙對不對
  push.onOpenRequest(() => { api.open(); life.pullBg?.().finally?.(() => openLineRoom()); });

  // ---------- 手機響：紅點、鎖定畫面通知、網頁上方的橫幅 ----------
  const banner = $(`<div id="bp-banner"><i>${ICON.line}</i><div><b></b><span></span></div></div>`);
  document.documentElement.appendChild(banner);
  let bannerTimer;
  let bannerApp = 'line';
  banner.addEventListener('click', () => {
    banner.classList.remove('bp-show'); api.open(); lock.classList.add('bp-gone'); phone.classList.remove('bp-locked');
    if (bannerApp === 'calendar') openApp(calendar); else if (bannerApp === 'notes') openApp(notes); else openLineRoom();
  });
  function showBanner(n) {
    bannerApp = n.app || 'line';
    banner.querySelector('b').textContent = n.app === 'threads' ? `脆・${n.who}` : n.app === 'calendar' ? `行事曆・${n.who}` : n.app === 'notes' ? `便條・${n.who}` : n.who;
    banner.querySelector('span').textContent = n.text;
    banner.classList.add('bp-show');
    const vv = window.visualViewport; const vw = vv ? vv.width : innerWidth;
    const w = banner.offsetWidth; const want = { left: (vw - w) / 2, top: 10 };
    Object.assign(banner.style, { left: `${want.left}px`, top: `${want.top}px` });
    const r = banner.getBoundingClientRect();
    Object.assign(banner.style, { left: `${2 * want.left - r.left}px`, top: `${2 * want.top - r.top}px` });
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => banner.classList.remove('bp-show'), 5000);
  }
  async function refreshNotices() {
    const list = await line.unseen();
    setBadge('line', list.length);
    document.getElementById('bp-launcher')?.setAttribute('data-n', list.length ? String(Math.min(list.length, 99)) : '');
    const hhmm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    overlay.querySelector('.bp-notifs').innerHTML = list.slice(-3).reverse().map((m) => `<div class="bp-notif" data-act="notif">
      <i>${ICON.line}</i><div><b>${m.who}</b><span>${String(m.text || (m.sticker ? '傳了貼圖' : m.gift ? '送妳一份禮物 🎁' : m.loc ? `傳了位置：${m.loc.place}` : m.img ? '傳了照片' : '')).replace(/</g, '&lt;')}</span></div><small>${hhmm(m.ts)}</small></div>`).join('')
      + (list.length > 3 ? `<div class="bp-notif-more">還有 ${list.length - 3} 則</div>` : '');
  }
  const life = createLife({
    line, say, onData: () => calDots(),
    onNotify: (n) => {
      refreshNotices();
      const inLine = overlay.classList.contains('bp-open') && appScreen.querySelector('.bp-line-roomv');
      if (inLine) return;
      if (overlay.classList.contains('bp-open')) say(`${n.who}：${n.text}`); else showBanner(n);
    },
    onStageHint: (key, v) => {
      overlay.querySelector('.bp-hintsheet')?.remove();
      phone.insertAdjacentHTML('beforeend', `<div class="bp-hintsheet" data-key="${key}" data-v="${v}"><div>
        <b>劇情裡，你們好像${v === 'married' ? '結婚了' : v === 'living' ? '住在一起了' : v === 'dating' ? '在一起了' : '有點曖昧了'}</b>
        <span>要把關係改成「${stage.name(v)}」嗎？會打開${v === 'living' ? '冰箱門' : v === 'dating' ? '陪睡模式' : v === 'flirt' ? '他主動找妳' : '新的東西'}。</span>
        <div><button data-act="hint-no">先不要</button><button data-act="hint-yes" class="ok">好</button></div></div></div>`);
      if (!overlay.classList.contains('bp-open')) showBanner({ who: '小手機', text: '你們的關係好像變了，打開手機看看' });
    },
  });
  setInterval(refreshNotices, 30000);
  // 切回這個分頁時（可能剛在別台裝置用過），重新跟伺服器對一次
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    store.refresh();
    loadDesk();
    if (!appScreen.querySelector('.bp-line-roomv')) line.forget();
    refreshNotices();
  });

  // 0.9.3 以前手機資料照角色存。新的聊天一律是新手機、不問；
  // 這個角色有舊紀錄、還沒搬過的話，設定裡才出現「把之前的紀錄搬進這個聊天」
  async function hasOldData() {
    const c = currentChar();
    if (!c || c.key === c.charKey) return false;
    try { if (localStorage.getItem(`brume-phone:migrated:${c.charKey}`)) return false; } catch { return false; }
    const [oldLine, oldIg, oldTh] = await Promise.all([`line:${c.charKey}`, `ig:${c.charKey}`, `threads:${c.charKey}`].map((k) => store.get(k).catch(() => null)));
    return !!(oldLine?.msgs?.length || oldIg?.posts?.length || oldTh?.posts?.length);
  }
  const stx = ctx();
  stx?.eventSource?.on?.(stx.eventTypes?.CHAT_CHANGED || stx.event_types?.CHAT_CHANGED || 'chat_id_changed', () => {
    line.forget(); closeApp(); his.close(); overlay.querySelectorAll('.bp-hintsheet').forEach((x) => x.remove());
    refreshNotices(); calDots();
  });
  setTimeout(refreshNotices, 1500);

  // LINE 裡點「他貼了便條／記上行事曆」那行小字，直接跳到那個 App
  appScreen.addEventListener('bp-openapp', (e) => { const app = { notes, calendar }[e.detail]; if (app) openApp(app); });

  // 主畫面日曆小工具：有安排的日子底下點一個小點
  async function calDots() {
    const c = currentChar();
    const evs = c ? await data.cal.all(c.key) : [];
    const now = new Date(); const pre = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const has = new Set(evs.filter((x) => x.date.startsWith(pre)).map((x) => +x.date.slice(8)));
    overlay.querySelectorAll('.bp-cal-grid span:not(.bp-dow)').forEach((sp) => sp.classList.toggle('bp-ev', has.has(+sp.textContent)));
  }
  data.onChange((kind) => { if (kind === 'cal') calDots(); });
  calDots();

  // 換角色時：日曆小點、正文同步都跟著換
  const st = ctx();
  st?.eventSource?.on?.(st.eventTypes?.CHAT_CHANGED || st.event_types?.CHAT_CHANGED || 'chat_id_changed', () => { calDots(); syncMain(); loadDesk(); });
  syncMain();
  const music = createMusic({ screen: appScreen, ytHost: overlay.querySelector('.bp-yt'), say });

  // 主畫面的音樂小工具跟著正在放的歌走
  nowPlaying.subscribe((p) => {
    overlay.querySelectorAll('.bp-music').forEach((w) => {
      const s = p.song;
      w.querySelector('.bp-music-t').textContent = s ? s.title : '還沒有歌';
      w.querySelector('.bp-music-a').textContent = s ? s.artist : '讓他推薦一首吧';
      w.querySelector('.bp-music-cover').innerHTML = s?.cover ? `<img src="${s.cover}" alt="">` : ICON.music;
      w.querySelector('[data-mw="toggle"]').innerHTML = p.playing ? ICON.pause : ICON.play;
    });
  });
  // LINE 的未讀也同步到桌面圖示的紅色數字；看完就清掉
  const appBadge = (n) => { try { if (n) navigator.setAppBadge?.(n).catch(() => {}); else navigator.clearAppBadge?.().catch(() => {}); } catch { /* 不支援就算了 */ } };
  function setBadge(app, n) {
    if (app === 'line') appBadge(n);
    overlay.querySelectorAll(`[data-open="${app}"] .bp-icon`).forEach((ic) => {
      ic.querySelector('.bp-badge')?.remove();
      if (n) ic.insertAdjacentHTML('beforeend', `<span class="bp-badge">${n > 99 ? '99+' : n}</span>`);
    });
  }

  const rebuild = () => {
    pages.innerHTML = PAGES.map((p) => `<div class="bp-page">${p.map(tile).join('')}</div>`).join('');
    calDots();
  };

  // 點外框外面也能收起來
  // 剛拖完放開在手機外面時不算「點外面」，不然一拖就收起來了
  overlay.addEventListener('click', (e) => {
    if (e.target !== overlay || Date.now() - lastDragEnd < 400) return;
    // 鍵盤剛彈出／收起、畫面還在動，或正在打字：不收手機，先把鍵盤收掉
    const typing = overlay.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (typing || Date.now() - vpChanged < 1000) { dbg('outside-ignored'); if (typing) document.activeElement.blur(); return; }
    close('outside');
  });

  const api = {
    open() { rememberChar(); store.refresh(); loadDesk(); line.forget(); applyEye(); life.onPhoneOpen(); refreshNotices(); closeApp(); his.close(); calDots(); lock.classList.remove('bp-gone'); phone.classList.add('bp-locked'); sheet.classList.remove('bp-show'); tick(); overlay.classList.add('bp-open'); tint(true); fit(); dbg('open'); },
    close,
    refreshPrompt: () => life.refreshPrompt(),
  };
  return api;
  function close(why = 'api') { dbg('close', why); overlay.classList.remove('bp-open'); tint(false); refreshNotices(); }
  // iPhone 最上面時間、電池那一條不是網頁的一部分，蓋不住；Safari 會照 theme-color 幫它上色。
  // 手機打開時換成黑色，跟手機外框融在一起，關掉再換回酒館原本的顏色（10/16 比比看到頂上一條酒館的藍灰色）
  // 10/16 除錯紀錄：她是從主畫面開的 App（pwa:true）、安全區 0——網頁從那條下面才開始，蓋不到，只能靠 theme-color 上色。
  // 只改 content 時主畫面 App 不會重畫那條，所以整個 meta 拿掉、換一個新的黑色進去；關掉再把原本的放回去
  let tintSaved = null; let tintMine = null;
  function tint(on) {
    try {
      if (on) {
        if (tintMine) return;
        tintSaved = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => [m, m.nextSibling, m.parentNode]);
        tintSaved.forEach(([m]) => m.remove());
        tintMine = document.createElement('meta'); tintMine.name = 'theme-color'; tintMine.content = '#000000';
        document.head.appendChild(tintMine);
      } else if (tintMine) {
        tintMine.remove(); tintMine = null;
        (tintSaved || []).forEach(([m, next, parent]) => { (parent || document.head).insertBefore(m, next && next.parentNode === parent ? next : null); });
        tintSaved = null;
      }
    } catch { /* 改不了就算了 */ }
  }
}

function shrink(fileObj, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(fileObj);
  });
}

// 小手機按鈕。位置記成「離畫面右邊、下面各多遠」，再用實際量到的位置換算成 left/top：
// 酒館在 <html> 上加了 transform，fixed 會改對 <html> 定位，手機版 <html> 幾乎沒有高度，
// 只寫 bottom 會把按鈕推到螢幕外面（iPhone 上看不到按鈕就是這樣）
// 桌面圖示換成玩家自己的照片：裁成正方形、存到酒館伺服器，網址記在擴充設定（app.html 讀 ?icon= 換掉圖示）
async function setAppIcon(f) {
  try {
    const img = await createImageBitmap(f);
    const s = Math.min(img.width, img.height); const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 512, 512);
    const url = await uploadImage(cv.toDataURL('image/png'));
    if (!url) throw new Error('存不上去');
    const c = ctx(); (c.extensionSettings['brume-phone'] ||= {}).appIcon = url; c.saveSettingsDebounced?.();
    window.dispatchEvent(new CustomEvent('bp-hint', { detail: '圖示換好了，再按一次「放到手機桌面」加到桌面' }));
  } catch (e) { window.dispatchEvent(new CustomEvent('bp-hint', { detail: `圖示沒換成功：${e.message || e}` })); }
}

// 記住上次開手機的是哪個角色（桌面的「霧語」圖示打開時直接回到他）
function rememberChar() {
  const c = ctx(); const ch = currentChar(); if (!c?.extensionSettings || !ch) return;
  const root = (c.extensionSettings['brume-phone'] ||= {});
  if (root.lastChar !== ch.charKey) { root.lastChar = ch.charKey; c.saveSettingsDebounced?.(); }
}

// ---------- Brume 開機畫面：從桌面圖示打開時，酒館載入那幾秒先蓋一張，載好了直接變成手機 ----------
// 玩家可以換照片、大字、小字。設定存在酒館的擴充設定；也抄一份在這台的 localStorage，
// 開機時酒館的設定還沒載好也能馬上蓋上去
const SPLASH_KEY = 'brume-phone:splash';
function splashConf() {
  let local = {}; try { local = JSON.parse(localStorage.getItem(SPLASH_KEY) || '{}'); } catch { /* 讀不到 */ }
  return { ...local, ...(ctx()?.extensionSettings?.['brume-phone']?.splash || {}) };
}
function setSplash(patch) {
  const c = ctx(); const root = c?.extensionSettings ? (c.extensionSettings['brume-phone'] ||= {}) : {};
  root.splash = patch ? { ...(root.splash || {}), ...patch } : {};
  c?.saveSettingsDebounced?.();
  try { localStorage.setItem(SPLASH_KEY, JSON.stringify(root.splash)); } catch { /* 存不了 */ }
}
// 開機畫面的樣式直接寫在這裡、開的時候才塞進去：style.css 被瀏覽器快取住舊版時，畫面會蓋不出來（10/17 按預覽沒反應）
const SPLASH_CSS = `/* Brume 開機畫面（從桌面圖示打開時，酒館載入那幾秒蓋在最上面） */
#bp-splash {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483600; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #687484 0%, #8d95a0 45%, #cec5b8 100%);
  background-image: var(--bp-splash-bg, none), linear-gradient(180deg, #687484 0%, #8d95a0 45%, #cec5b8 100%);
  background-size: cover; background-position: center;
  opacity: 0; transition: opacity .6s ease; overflow: hidden; color: #fff;
  font-family: Georgia, "Times New Roman", "Noto Serif TC", "Songti TC", serif;
}
#bp-splash.on { opacity: 1; }
#bp-splash.has-bg::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, rgba(20, 24, 32, .15) 0%, rgba(20, 24, 32, .05) 40%, rgba(20, 24, 32, .55) 100%); }
#bp-splash .bp-splash-mist {
  position: absolute; left: -30%; right: -30%; bottom: -10%; height: 55%;
  background: radial-gradient(ellipse at 30% 60%, rgba(255, 255, 255, .55), transparent 60%), radial-gradient(ellipse at 75% 75%, rgba(255, 255, 255, .45), transparent 55%);
  filter: blur(18px); animation: bp-mist 9s ease-in-out infinite alternate;
}
#bp-splash.has-bg .bp-splash-mist { opacity: .45; }
@keyframes bp-mist { from { transform: translateX(-6%); } to { transform: translateX(6%); } }
#bp-splash .bp-splash-txt { position: relative; text-align: center; transform: translateY(-6vh); }
#bp-splash .bp-splash-txt b { display: block; font-weight: 400; font-size: clamp(44px, 14vw, 72px); letter-spacing: .04em; text-shadow: 0 2px 18px rgba(30, 34, 44, .35); }
#bp-splash .bp-splash-txt span { display: block; margin-top: 8px; font-size: 16px; letter-spacing: .3em; opacity: .9; text-shadow: 0 1px 8px rgba(30, 34, 44, .4); }
#bp-splash .bp-splash-dots { position: absolute; bottom: calc(48px + env(safe-area-inset-bottom)); display: flex; gap: 8px; }
#bp-splash .bp-splash-dots u { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, .85); animation: bp-sdot 1.2s ease-in-out infinite; }
#bp-splash .bp-splash-dots u:nth-child(2) { animation-delay: .2s; }
#bp-splash .bp-splash-dots u:nth-child(3) { animation-delay: .4s; }
@keyframes bp-sdot { 0%, 100% { opacity: .25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
#bp-splash:not(.has-bg) .bp-splash-dots u { background: rgba(70, 78, 92, .55); }
`;
function showSplash(why = 'launch') {
  // 上一張還掛著（例如預覽按太快、或開機那張沒收乾淨）就先拆掉重蓋，不要默默不動
  document.getElementById('bp-splash')?.remove();
  dbg('splash-show', why);
  if (!document.getElementById('bp-splash-css')) { const st = document.createElement('style'); st.id = 'bp-splash-css'; st.textContent = SPLASH_CSS; document.head.appendChild(st); }
  const sp = splashConf();
  const el = document.createElement('div'); el.id = 'bp-splash';
  if (sp.bg) el.style.setProperty('--bp-splash-bg', `url("${String(sp.bg).replace(/"/g, '%22')}")`);
  el.className = sp.bg ? 'has-bg' : '';
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  el.innerHTML = `<div class="bp-splash-mist"></div><div class="bp-splash-txt"><b>${esc(sp.title || 'Brume')}</b><span>${esc(sp.line || '霧語')}</span></div><i class="bp-splash-dots"><u></u><u></u><u></u></i>`;
  // iPhone 的 Brume App 裡 inset:0 量出來高度是 0（10/17 除錯紀錄 rect=0,0,393x0），
  // 所以跟 #bp-overlay 一樣直接給它看得到的範圍那麼大
  const vv = window.visualViewport;
  el.style.width = `${Math.round(vv ? vv.width : innerWidth)}px`; el.style.height = `${Math.round(vv ? vv.height : innerHeight)}px`;
  document.documentElement.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  // 10/17 比比的 iPhone 按預覽沒畫面：記下蓋上去之後它到底長怎樣（透明度、層級、位置），給格看
  setTimeout(() => { try { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); dbg('splash-vis', `${el.isConnected ? 'in' : 'gone'} op=${cs.opacity} z=${cs.zIndex} pos=${cs.position} disp=${cs.display} rect=${Math.round(b.top)},${Math.round(b.left)},${Math.round(b.width)}x${Math.round(b.height)} top=${(() => { const t = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return t ? t.tagName + '.' + String(t.className || t.id || '').slice(0, 20) : null; })()}`); } catch (err) { dbg('splash-vis-err', String(err?.message || err)); } }, 400);
}
function hideSplash() {
  const el = document.getElementById('bp-splash'); if (!el) return;
  el.classList.remove('on'); setTimeout(() => el.remove(), 700);
}

// 被 app.html 那層包著（桌面圖示打開的是霧語自己那頁，酒館在它的 iframe 裡）：開機畫面由外面那頁蓋，這裡只要報「手機開好了」
const SHELL = (() => { try { return window.parent !== window && !!window.parent.document.getElementById('bp-shell'); } catch { return false; } })();
const tellShell = (msg) => { if (!SHELL) return; try { window.parent.postMessage(msg, location.origin); } catch { /* 外面那頁不在就算了 */ } };

// 從桌面的「霧語」圖示打開（網址帶 bp-app，或被 app.html 包著）：等酒館載好、選上次那個角色，再打開手機
function launchFromIcon(phone) {
  let u; try { u = new URL(location.href); } catch { return; }
  // iPhone 桌面上每個網頁 App 的儲存是分開的：從 Brume 圖示開過一次就記一筆，
  // 之後就算網址上的 bp-app 掉了（例如被登入頁轉走），在這個 App 裡一樣直接開手機
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone = !!navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let remembered = false; try { remembered = ios && standalone && localStorage.getItem('brume-phone:app-mode') === '1'; } catch { /* 讀不到 */ }
  if (!u.searchParams.has('bp-app') && !remembered && !SHELL) return;
  if (ios && standalone) { try { localStorage.setItem('brume-phone:app-mode', '1'); } catch { /* 存不了 */ } }
  if (u.searchParams.has('bp-app') || u.searchParams.has('bp-shell')) { u.searchParams.delete('bp-app'); u.searchParams.delete('bp-shell'); history.replaceState(null, '', u.href); }
  if (SHELL) tellShell({ type: 'bp-splash', conf: splashConf() }); else { showSplash(); setTimeout(hideSplash, 30000); } // 萬一卡住，三十秒後還是讓她看得到酒館
  const shownAt = Date.now(); // 10/17 比比說照片只閃一秒：酒館載得快的時候，開機畫面至少留 2.5 秒再收
  const c = ctx(); if (!c?.eventSource) { hideSplash(); tellShell({ type: 'bp-ready' }); return; }
  const go = async () => {
    const want = c.extensionSettings?.['brume-phone']?.lastChar;
    const i = want ? (c.characters || []).findIndex((x) => (x.avatar || x.name) === want) : -1;
    if (i >= 0 && String(c.characterId) !== String(i)) {
      await new Promise((res) => { c.eventSource.once?.(c.eventTypes?.CHAT_CHANGED || 'chat_id_changed', res); setTimeout(res, 8000); c.selectCharacterById?.(String(i)); });
    }
    setTimeout(() => { phone.open(); tellShell({ type: 'bp-ready' }); setTimeout(hideSplash, Math.max(250, 2500 - (Date.now() - shownAt))); }, 300);
  };
  // 酒館載好會發 APP_READY；有些版本或擴充會讓它晚到，所以也每秒看一次角色清單載好了沒，先到的那個做
  let done = false;
  const once = () => { if (done) return; done = true; clearInterval(t); setTimeout(go, 500); };
  c.eventSource.on(c.eventTypes?.APP_READY || 'app_ready', once);
  let n = 0; const t = setInterval(() => { const cc = ctx(); if ((cc?.characters?.length && cc.extensionSettings?.['brume-phone']) || ++n > 30) once(); }, 1000);
}

// 這張卡關掉小手機時：按鈕收起來，魔杖選單那一項改成「打開」
function syncOff() {
  const ch = currentChar(); const off = !!ch && phoneOff.is(ch.charKey);
  const btn = document.getElementById('bp-launcher'); if (btn) btn.style.display = off ? 'none' : '';
  const w = document.querySelector('#bp-wand span'); if (w) w.textContent = off ? '霧語 Brume Phone（這張卡關著，點了打開）' : '霧語 Brume Phone';
}

function launcher(phone) {
  const btn = $(`<div id="bp-launcher" title="霧語 Brume Phone">${ICON.phone}</div>`);
  document.documentElement.appendChild(btn);
  let off = { r: 14, b: 140 };
  if (state.btn && typeof state.btn.r === 'number') off = state.btn;

  const place = () => {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : innerWidth; const vh = vv ? vv.height : innerHeight;
    const size = btn.offsetWidth || 46;
    off.r = Math.min(Math.max(off.r, 4), vw - size - 4);
    off.b = Math.min(Math.max(off.b, 4), vh - size - 4);
    const want = { left: vw - off.r - size, top: vh - off.b - size };
    Object.assign(btn.style, { right: 'auto', bottom: 'auto', left: `${want.left}px`, top: `${want.top}px` });
    // 量一下實際落在哪，差多少補多少（外層有 transform 時，left/top 的原點不是螢幕左上角）
    const r = btn.getBoundingClientRect();
    btn.style.left = `${want.left + (want.left - r.left)}px`;
    btn.style.top = `${want.top + (want.top - r.top)}px`;
  };
  place();
  addEventListener('resize', place);
  addEventListener('scroll', place, { passive: true });
  window.visualViewport?.addEventListener('resize', place);
  window.visualViewport?.addEventListener('scroll', place);
  setTimeout(place, 1000); // 酒館載完版面可能又動一次

  // 可以拖著移位置，短按才開手機
  let start = null; let moved = false;
  btn.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, r: off.r, b: off.b };
    moved = false; btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x; const dy = e.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) { off = { r: start.r - dx, b: start.b - dy }; place(); }
  });
  btn.addEventListener('pointerup', () => {
    if (!moved) phone.open();
    else { state.btn = { ...off }; save(state); }
    start = null;
  });
}

// 魔杖選單（輸入框左邊那支）裡也放一個入口，手機上按鈕被擋住時從這裡開
function wandEntry(phone) {
  const menu = document.getElementById('extensionsMenu');
  if (!menu) return false;
  if (document.getElementById('bp-wand')) return true;
  const item = $(`<div id="bp-wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
    <div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton"></div><span>霧語 Brume Phone</span></div>`);
  item.addEventListener('click', () => {
    menu.style.display = 'none';
    const ch = currentChar();
    if (ch && phoneOff.is(ch.charKey)) {
      if (!confirm(`${ch.name} 這張卡要打開小手機嗎？`)) return;
      phoneOff.set(ch.charKey, false); syncOff(); phone.refreshPrompt?.();
    }
    phone.open();
  });
  menu.appendChild(item);
  return true;
}

(function init() {
  if (document.getElementById('bp-launcher')) return;
  const phone = build();
  launcher(phone);
  launchFromIcon(phone);
  if (!wandEntry(phone)) {
    let n = 0;
    const t = setInterval(() => { if (wandEntry(phone) || ++n > 40) { clearInterval(t); syncOff(); } }, 500);
  }
  syncOff();
  const c = ctx(); c?.eventSource?.on?.(c.eventTypes?.CHAT_CHANGED || c.event_types?.CHAT_CHANGED || 'chat_id_changed', () => { syncOff(); const ch = currentChar(); if (ch && phoneOff.is(ch.charKey)) phone.close?.('cardoff'); });
})();
