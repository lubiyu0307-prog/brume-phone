// Brume Phone · 介面樣品 v0.1
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
import * as stage from './stage.js';
import { currentChar, ctx, lite, DATA_PREFIXES } from './st.js';
import * as store from './store.js';
import * as data from './data.js';
import { createMusic, nowPlaying } from './music.js';

const KEY = 'brume-phone:v1';
const VERSION = '0.18.6';

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
  const src = state.photos?.[slot];
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

function appTile(a) {
  return `<div class="bp-app" data-open="${a.app}"><div class="bp-icon">${ICON[a.app]}</div><div class="bp-label">${a.name}</div></div>`;
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
          <div class="bp-lock-chips"><div class="bp-round">${ICON.music}</div></div>
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
      <div class="bp-setrow"><span>護眼模式</span><div class="bp-seg" data-seg="eye">${[['off', '關'], ['on', '開'], ['auto', '晚上自動']].map(([k, n]) => `<b data-act="eye" data-v="${k}">${n}</b>`).join('')}</div></div>
      <p class="bp-sheet-note">畫面暗一點、偏暖色，白底不刺眼。晚上自動：晚上七點到早上七點自動打開。</p>
      <button data-act="lite" class="bp-switchrow">省 token 模式<i></i></button>
      <p class="bp-sheet-note">開著：只送角色卡、被叫到的世界書和正文最後幾則，比正文一次少很多。關掉：送整份預設和整段正文，跟正文一樣貴，但他看得最完整。傳照片給他時一律走完整的。</p>
      <button data-act="mig-yes" class="bp-migbtn" hidden>把之前的紀錄搬進這個聊天</button>
      <button data-act="his">偷看他的手機</button>
      <button data-act="wall">換桌布</button>
      <button data-act="wall-reset">用回預設桌布</button>
      <button data-act="photos-reset">清掉小工具照片</button>
      <button data-act="dbg">複製除錯紀錄（給格看）</button>
      <button class="bp-cancel" data-act="close">完成</button>
      <div class="bp-ver">Brume Phone v${VERSION}</div>
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
    overlay.querySelector('.bp-wall').style.backgroundImage = state.wall ? `url('${state.wall}')` : '';
  };
  applyWall();

  const tick = () => {
    const n = new Date();
    const hm = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    overlay.querySelector('.bp-clock').textContent = hm;
    overlay.querySelector('.bp-lock-time').textContent = hm;
    overlay.querySelector('.bp-lock-date').textContent = `${n.getMonth() + 1}月${n.getDate()}日 星期${WEEK[n.getDay()]}`;
  };
  tick(); setInterval(tick, 10000);

  let toastTimer;
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
      if (a === 'wall') { pickTarget = 'wall'; file.click(); }
      if (a === 'wall-reset') { delete state.wall; save(state); applyWall(); say('用回預設桌布了'); }
      if (a === 'photos-reset') { state.photos = {}; save(state); rebuild(); say('照片清掉了'); }
      if (a === 'close') sheet.classList.remove('bp-show');
      if (a === 'dbg') {
        let txt = ''; try { txt = localStorage.getItem(DBG_KEY) || '[]'; } catch { /* 讀不到 */ }
        txt = `Brume Phone v${VERSION} ${navigator.userAgent}\n${txt}`;
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
    const url = await shrink(f, pickTarget === 'wall' ? 1290 : 900);
    if (pickTarget === 'wall') state.wall = url;
    else (state.photos ||= {})[pickTarget] = url;
    if (!save(state)) { say('照片太大，存不下'); return; }
    if (pickTarget === 'wall') { applyWall(); say('桌布換好了'); } else rebuild();
  });

  // App 畫面：從右邊滑進來，蓋在主畫面上
  const appScreen = overlay.querySelector('.bp-appscreen');
  const openApp = (app) => { music?.leave(); app.open(); appScreen.classList.add('bp-show'); phone.classList.add('bp-app-open'); };
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
  st?.eventSource?.on?.(st.eventTypes?.CHAT_CHANGED || st.event_types?.CHAT_CHANGED || 'chat_id_changed', () => { calDots(); syncMain(); });
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
  function setBadge(app, n) {
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
    open() { store.refresh(); line.forget(); applyEye(); life.onPhoneOpen(); refreshNotices(); closeApp(); his.close(); calDots(); lock.classList.remove('bp-gone'); phone.classList.add('bp-locked'); sheet.classList.remove('bp-show'); tick(); overlay.classList.add('bp-open'); fit(); dbg('open'); },
    close,
  };
  return api;
  function close(why = 'api') { dbg('close', why); overlay.classList.remove('bp-open'); refreshNotices(); }
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
function launcher(phone) {
  const btn = $(`<div id="bp-launcher" title="Brume Phone">${ICON.phone}</div>`);
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
    <div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton"></div><span>Brume Phone</span></div>`);
  item.addEventListener('click', () => { menu.style.display = 'none'; phone.open(); });
  menu.appendChild(item);
  return true;
}

(function init() {
  if (document.getElementById('bp-launcher')) return;
  const phone = build();
  launcher(phone);
  if (!wandEntry(phone)) {
    let n = 0;
    const t = setInterval(() => { if (wandEntry(phone) || ++n > 40) clearInterval(t); }, 500);
  }
})();
