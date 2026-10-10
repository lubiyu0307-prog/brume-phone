// Brume Phone · 介面樣品 v0.1
// 只有畫面：鎖定畫面、兩頁主畫面、換桌布、換照片小工具。App 點下去還不會開。

import { createLine } from './line.js';

const KEY = 'brume-phone:v1';
const VERSION = '0.2.0';

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
  torch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 3h8v4l-2 3v11h-4V10L8 7z"/><path d="M12 13v2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
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
    <div class="bp-music-ctl">${ICON.prev}${ICON.play}${ICON.next}</div></div>`;
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
      <div class="bp-lock-bottom">
        <div class="bp-lock-row">
          <div class="bp-weather"><b>☁︎ 24°</b><br>多雲<br>高 27° 低 21°</div>
          <div class="bp-lock-chips"><div class="bp-round">${ICON.music}</div></div>
        </div>
        <div class="bp-lock-tools"><div class="bp-round">${ICON.torch}</div><div class="bp-round">${ICON.camera}</div></div>
        <div class="bp-hint">往上滑或點一下解鎖</div>
      </div>
    </div>
    <div class="bp-appscreen"></div>
    <div class="bp-close" title="收起手機">${ICON.x}</div>
    <div class="bp-toast"></div>
    <div class="bp-sheet">
      <h3>設定</h3>
      <button data-act="wall">換桌布</button>
      <button data-act="wall-reset">用回預設桌布</button>
      <button data-act="photos-reset">清掉小工具照片</button>
      <button class="bp-cancel" data-act="close">完成</button>
      <div class="bp-ver">Brume Phone v${VERSION}</div>
    </div>
    <input type="file" accept="image/*" hidden>
  </div></div>`);
  // 掛在 <html> 底下，不放進 <body>：手機版酒館和一些主題會在 body 裡加 transform／filter，
  // 那會把 position:fixed 關在一個小框裡（v0.1.1 在 iPhone 上只剩半截就是這樣）
  document.documentElement.appendChild(overlay);
  const fit = () => {
    const vv = window.visualViewport;
    overlay.style.setProperty('--bp-h', `${Math.round(vv ? vv.height : innerHeight)}px`);
    overlay.style.setProperty('--bp-w', `${Math.round(vv ? vv.width : innerWidth)}px`);
    overlay.style.top = `${Math.round(vv ? vv.offsetTop : 0)}px`;
    overlay.style.setProperty('--bp-top', `${Math.round(vv ? vv.offsetTop : 0)}px`);
    overlay.style.left = `${Math.round(vv ? vv.offsetLeft : 0)}px`;
  };
  fit();
  addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);

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
    if (dy > 40 || Math.abs(dy) < 8) { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); }
  });

  // 頁面圓點
  pages.addEventListener('scroll', () => {
    const i = Math.round(pages.scrollLeft / pages.clientWidth);
    overlay.querySelectorAll('.bp-dots i').forEach((d, k) => d.classList.toggle('bp-on', k === i));
  }, { passive: true });

  // 點圓點跳頁
  const goPage = (i) => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' });
  overlay.querySelectorAll('.bp-dots i').forEach((d, i) => d.addEventListener('click', () => goPage(i)));

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
    drag = null; pages.style.scrollSnapType = '';
    if (dragged) goPage(Math.max(0, Math.min(PAGES.length - 1, from + (dx < -40 ? 1 : dx > 40 ? -1 : 0))));
  });

  // 點擊
  phone.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    const slot = e.target.closest('[data-slot]');
    if (slot) { pickTarget = slot.dataset.slot; file.click(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'wall') { pickTarget = 'wall'; file.click(); }
      if (a === 'wall-reset') { delete state.wall; save(state); applyWall(); say('用回預設桌布了'); }
      if (a === 'photos-reset') { state.photos = {}; save(state); rebuild(); say('照片清掉了'); }
      if (a === 'close') sheet.classList.remove('bp-show');
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) {
      if (open.dataset.open === 'settings') { sheet.classList.add('bp-show'); return; }
      if (open.dataset.open === 'line') { openApp(line); return; }
      say('這個 App 還在做 ☁︎');
      return;
    }
    if (e.target.closest('.bp-homebar') || e.target.closest('.bp-close')) close();
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
  const openApp = (app) => { app.open(); appScreen.classList.add('bp-show'); phone.classList.add('bp-app-open'); };
  const closeApp = () => { appScreen.classList.remove('bp-show'); phone.classList.remove('bp-app-open'); };
  appScreen.addEventListener('bp-home', closeApp);
  const line = createLine({ screen: appScreen, say, onUnread: (n) => setBadge('line', n) });
  function setBadge(app, n) {
    overlay.querySelectorAll(`[data-open="${app}"] .bp-icon`).forEach((ic) => {
      ic.querySelector('.bp-badge')?.remove();
      if (n) ic.insertAdjacentHTML('beforeend', `<span class="bp-badge">${n > 99 ? '99+' : n}</span>`);
    });
  }

  const rebuild = () => {
    pages.innerHTML = PAGES.map((p) => `<div class="bp-page">${p.map(tile).join('')}</div>`).join('');
  };

  // 點外框外面也能收起來
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return {
    open() { fit(); closeApp(); lock.classList.remove('bp-gone'); phone.classList.add('bp-locked'); sheet.classList.remove('bp-show'); tick(); overlay.classList.add('bp-open'); },
    close,
  };
  function close() { overlay.classList.remove('bp-open'); }
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

function launcher(phone) {
  const btn = $(`<div id="bp-launcher" title="Brume Phone">${ICON.phone}</div>`);
  document.documentElement.appendChild(btn);
  // 可以拖著移位置，短按才開手機
  let start = null; let moved = false;
  btn.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, r: parseFloat(getComputedStyle(btn).right), b: parseFloat(getComputedStyle(btn).bottom) };
    moved = false; btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x; const dy = e.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) { btn.style.right = `${start.r - dx}px`; btn.style.bottom = `${start.b - dy}px`; }
  });
  btn.addEventListener('pointerup', () => {
    if (!moved) phone.open();
    else { state.btn = { r: btn.style.right, b: btn.style.bottom }; save(state); }
    start = null;
  });
  if (state.btn) { btn.style.right = state.btn.r; btn.style.bottom = state.btn.b; }
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

// 存下來的按鈕位置如果跑出螢幕外（例如在電腦上拖過），拉回來
function keepOnScreen(btn) {
  const r = btn.getBoundingClientRect();
  if (r.right > innerWidth || r.left < 0 || r.bottom > innerHeight || r.top < 0) {
    btn.style.right = '14px'; btn.style.bottom = '140px';
  }
}

(function init() {
  if (document.getElementById('bp-launcher')) return;
  const phone = build();
  launcher(phone);
  keepOnScreen(document.getElementById('bp-launcher'));
  addEventListener('resize', () => keepOnScreen(document.getElementById('bp-launcher')));
  if (!wandEntry(phone)) {
    let n = 0;
    const t = setInterval(() => { if (wandEntry(phone) || ++n > 40) clearInterval(t); }, 500);
  }
})();
