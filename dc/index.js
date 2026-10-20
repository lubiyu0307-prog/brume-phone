// 霧語 · Discord 版：腦子在 Discord 的小手機。從 brume-phone 0.25.12 拔出來，拿掉酒館、LINE、電話、推播，
// 資料住在推播站上這支手機的 kv（server/dc.mjs），格在 Discord 那邊寫，這裡五秒內長出來。

import { createNotes, createCalendar } from './apps.js';
import { createThreads } from './threads.js';
import { createHisPhone } from './hisphone.js';
import { createAlbum } from './album.js';
import { createIG } from './ig.js';
import { createGames } from './games.js';
import { createFind, createParcels, skyIcon } from './world.js';
import * as realwx from './realwx.js';
import * as stage from './stage.js';
import { currentChar, uploadImage, dropImage, whenProfile, geminiKey, openaiKey, textModelPref, imageModelPref, imageResPref, engines, imageEnginePref, keyRoute, brain } from './st.js';
import * as store from './store.js';
import * as data from './data.js';
import { createMusic, nowPlaying } from './music.js';

const KEY = 'brume-phone:v1';
const VERSION = '1.0.0';

const ICON = {
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/></svg>',
  threads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M16.8 8.6C16 6 14.2 4.5 11.8 4.5 8 4.5 5.5 7.6 5.5 12s2.5 7.5 6.3 7.5c3 0 5.3-1.6 5.3-4.3 0-2.4-2-3.7-4.8-3.7-2.2 0-3.6 1-3.6 2.4 0 1.3 1.1 2.2 2.6 2.2 2.4 0 3.6-1.8 3.6-5"/></svg>',
  album: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 11v3M6 12.5h3"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor" stroke="none"/><circle cx="17.5" cy="13.8" r=".9" fill="currentColor" stroke="none"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  parcel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.2l8.4 4.6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12L9.5 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l10.5-6z"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  wifi: '<svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM3.8 7.2a6 6 0 0 1 8.4 0l-1.2 1.2a4.3 4.3 0 0 0-6 0zM1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.2 1.2a7.9 7.9 0 0 0-11.2 0z"/></svg>',
  battery: '<svg viewBox="0 0 27 12" fill="none" stroke="currentColor"><rect x=".5" y=".5" width="23" height="11" rx="3.2" opacity=".5"/><rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M25 4.2v3.6" stroke-width="1.4" stroke-linecap="round" opacity=".5"/></svg>',
  dc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5z"/></svg>',
};

const PAGES = [
  [
    { w: 'w4', kind: 'calendar' },
    { w: 'w2', kind: 'photo', slot: 'p1' },
    { app: 'ig', name: 'Instagram' },
    { app: 'threads', name: 'Threads' },
    { app: 'album', name: '圖庫' },
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
    { app: 'find', name: '尋找' },
    { app: 'parcel', name: '包裹' },
    { app: 'settings', name: '設定' },
  ],
];
const DOCK = [
  { app: 'dc', name: 'Discord' },
  { app: 'ig', name: 'Instagram' },
  { app: 'camera', name: '快照' },
  { app: 'music', name: '音樂' },
];
const DC_URL = (() => { try { return localStorage.getItem('wuyu:dcurl') || 'https://discord.com/channels/@me'; } catch { return 'https://discord.com/channels/@me'; } })();

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } }
let state = load();
const DESK = 'desk';
let desk = { wall: '', photos: {} };

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const pad = (n) => String(n).padStart(2, '0');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const escT = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

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
function appTile(a) {
  if (a.app === 'dc') return `<a class="bp-app" href="${DC_URL}" target="_blank" rel="noopener"><div class="bp-icon">${ICON.dc}</div><div class="bp-label">${a.name}</div></a>`;
  return `<div class="bp-app" data-open="${a.app}"><div class="bp-icon">${ICON[a.app]}</div><div class="bp-label">${a.name}</div></div>`;
}
function tile(t) {
  if (t.app) return appTile(t);
  if (t.kind === 'calendar') return calendarWidget();
  if (t.kind === 'music') return musicWidget();
  return photoWidget(t.w, t.slot);
}

function build() {
  const overlay = $(`<div id="bp-overlay"><div class="bp-phone bp-locked">
    <div class="bp-wall"></div>
    <div class="bp-status"><span class="bp-clock"></span><span class="bp-sys">${ICON.wifi}${ICON.battery}</span></div>
    <div class="bp-home">
      <div class="bp-pages">${PAGES.map((p) => `<div class="bp-page">${p.map(tile).join('')}</div>`).join('')}</div>
      <div class="bp-dots">${PAGES.map((_, i) => `<i class="${i ? '' : 'bp-on'}"></i>`).join('')}</div>
      <div class="bp-dock">${DOCK.map(appTile).join('')}</div>
      <div class="bp-homebar" title="鎖定"><i></i></div>
    </div>
    <div class="bp-lock">
      <div class="bp-lock-date"></div>
      <div class="bp-lock-time"></div>
      <div class="bp-notifs"></div>
      <div class="bp-lock-bottom">
        <div class="bp-lock-row">
          <div class="bp-weather" hidden></div>
          <div class="bp-lock-chips"><div class="bp-round" data-act="music" title="音樂">${ICON.music}</div></div>
        </div>
        <div class="bp-lock-tools"><div class="bp-round bp-swap" data-act="his" title="偷看他的手機">${ICON.swap}</div><div class="bp-round" data-act="snap" title="快照">${ICON.camera}</div></div>
        <div class="bp-hint">往上滑或點一下解鎖</div>
      </div>
    </div>
    <div class="bp-appscreen"></div>
    <div class="bp-app-home" title="回到桌面"><i></i></div>
    <div class="bp-his"></div>
    <div class="bp-yt"></div>
    <div class="bp-toast"></div>
    <div class="bp-sheet">
      <h3>設定</h3>
      <div class="bp-checkup"></div>
      <section class="bp-setgrp"><h4>你們</h4>
        <div class="bp-setrow"><span>你們的關係</span><div class="bp-seg" data-seg="stage">${stage.STAGES.map((x) => `<b data-act="stage" data-v="${x.id}">${x.name}</b>`).join('')}</div></div>
        <p class="bp-sheet-note">交往有尋找，同居有冰箱門。</p>
        <button data-act="his">偷看他的手機</button>
        <div class="bp-setrow"><span>妳現實住的城市</span><input class="bp-city-in" maxlength="30" placeholder="台北"></div>
        <p class="bp-sheet-note">鎖定畫面的天氣是格每小時從他那邊抓進來的。</p>
      </section>
      <section class="bp-setgrp"><h4>腦子</h4>
        <div class="bp-setrow"><span>Google 金鑰</span><input class="bp-key-in" data-key="gemini" placeholder="AIza… 或 AQ.…" autocomplete="off"></div>
        <p class="bp-sheet-note">AI Studio 的或 Vertex 快速模式的都可以，貼進去它自己認路。生圖用這把；字由格本人寫，他沒接到時才用這把寫。只存在這台的瀏覽器裡。</p>
        <div class="bp-setrow"><span>OpenAI 金鑰（選填）</span><input class="bp-key-in" data-key="openai" placeholder="sk-…" autocomplete="off"></div>
        <p class="bp-sheet-note">貼了可以用 GPT 生圖（gpt-image-2），兩家都有的時候按生成會問用哪家。</p>
        <div class="bp-setrow"><span>寫字用的模型</span><input class="bp-key-in" data-key="model" placeholder="自動挑（flash）" autocomplete="off"></div>
        <div class="bp-setrow"><span>生圖畫質</span><div class="bp-seg" data-seg="res">${[['1K', '1K'], ['2K', '2K']].map(([k, n]) => `<b data-act="res" data-v="${k}">${n}</b>`).join('')}</div></div>
        <button data-act="logout" class="bp-danger">換一支手機（登出）</button>
      </section>
      <section class="bp-setgrp"><h4>畫面</h4>
        <div class="bp-setrow"><span>護眼模式</span><div class="bp-seg" data-seg="eye">${[['off', '關'], ['on', '開'], ['auto', '晚上自動']].map(([k, n]) => `<b data-act="eye" data-v="${k}">${n}</b>`).join('')}</div></div>
        <p class="bp-sheet-note">暗一點、偏暖色。晚上自動＝晚上七點到早上七點。</p>
        <button data-act="wall">換桌布</button>
        <button data-act="wall-reset">用回預設桌布</button>
        <button data-act="photos-reset">清掉小工具照片</button>
      </section>
      <details class="bp-setgrp"><summary>開機畫面</summary>
        <p class="bp-sheet-note">每次打開霧語先蓋這張，照片和字都能換。手機上把這一頁「加入主畫面」，點圖示就直接開。</p>
        <div class="bp-setrow"><span>開機畫面的大字</span><input class="bp-splash-in" data-splash="title" maxlength="20" placeholder="Brume"></div>
        <div class="bp-setrow"><span>開機畫面的小字</span><input class="bp-splash-in" data-splash="line" maxlength="40" placeholder="霧語"></div>
        <button data-act="splashbg">換開機畫面的照片</button>
        <button data-act="splashprev">看一下開機畫面</button>
        <button data-act="splashreset">開機畫面用回預設</button>
      </details>
      <button class="bp-cancel" data-act="close">完成</button>
      <div class="bp-ver">霧語 Brume Phone · Discord 版 v${VERSION} · by Lubí</div>
    </div>
    <input type="file" accept="image/*" hidden>
  </div></div>`);
  document.getElementById('app').appendChild(overlay);

  // 大小：鋪滿看得到的範圍（鍵盤彈出時跟著縮）
  const fit = () => {
    const vv = window.visualViewport;
    const W = Math.round(vv ? vv.width : innerWidth); const H = Math.round(vv ? vv.height : innerHeight);
    overlay.style.setProperty('--bp-w', `${W}px`); overlay.style.setProperty('--bp-h', `${H}px`);
    overlay.style.setProperty('--bp-left', '0px'); overlay.style.setProperty('--bp-top', `${Math.round(vv ? (vv.pageTop != null ? vv.pageTop - scrollY : vv.offsetTop) : 0)}px`);
    overlay.classList.toggle('bp-kb', !!vv && vv.height < innerHeight - 120);
    if (scrollY) try { scrollTo(0, 0); } catch { /* 捲不動就算了 */ }
  };
  fit();
  const refit = () => { fit(); requestAnimationFrame(() => requestAnimationFrame(fit)); setTimeout(fit, 350); };
  addEventListener('resize', refit);
  window.visualViewport?.addEventListener('resize', refit);
  window.visualViewport?.addEventListener('scroll', fit);
  overlay.addEventListener('focusin', refit);
  overlay.addEventListener('focusout', (e) => {
    setTimeout(refit, 50);
    setTimeout(() => {
      for (let el = e.target; el && el !== overlay.parentElement; el = el.parentElement) {
        if (!el.scrollTop) continue;
        const ov = getComputedStyle(el).overflowY;
        if (ov !== 'auto' && ov !== 'scroll') el.scrollTop = 0;
      }
    }, 80);
  });

  const phone = overlay.querySelector('.bp-phone');
  const lock = overlay.querySelector('.bp-lock');
  const pages = overlay.querySelector('.bp-pages');
  const sheet = overlay.querySelector('.bp-sheet');
  const file = overlay.querySelector('input[type=file]');
  const toast = overlay.querySelector('.bp-toast');
  let pickTarget = null;

  const applyWall = () => { overlay.querySelector('.bp-wall').style.backgroundImage = desk.wall ? `url('${desk.wall}')` : ''; };

  let deskSeen = JSON.stringify(desk);
  const deskKey = () => `${DESK}:${currentChar().charKey}`;
  const loadDesk = async () => {
    const d = (await store.get(deskKey())) || { wall: '', photos: {} };
    desk = { wall: d.wall || '', photos: { ...(d.photos || {}) } };
    const now = JSON.stringify(desk);
    if (now === deskSeen) return;
    deskSeen = now; applyWall(); rebuild();
  };
  const saveDesk = async () => { deskSeen = JSON.stringify(desk); await store.set(deskKey(), desk); };

  const tick = () => {
    const n = new Date();
    const hm = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    overlay.querySelector('.bp-clock').textContent = hm;
    overlay.querySelector('.bp-lock-time').textContent = hm;
    overlay.querySelector('.bp-lock-date').textContent = `${n.getMonth() + 1}月${n.getDate()}日 星期${WEEK[n.getDay()]}`;
  };
  tick(); setInterval(tick, 10000);

  let toastTimer;
  const hinted = new Map();
  window.addEventListener('bp-hint', (e) => { const t = String(e.detail || ''); if (!t || Date.now() - (hinted.get(t) || 0) < 600e3) return; hinted.set(t, Date.now()); setTimeout(() => say(t), 300); });
  const say = (msg) => {
    toast.textContent = msg; toast.classList.add('bp-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('bp-show'), 1800);
  };

  // 解鎖：點一下或往上滑
  let y0 = null;
  lock.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  lock.addEventListener('pointerup', (e) => {
    if (y0 === null) return;
    const dy = y0 - e.clientY; y0 = null;
    if (e.target.closest('[data-act]')) return;
    if (dy > 40 || Math.abs(dy) < 8) { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); }
  });

  pages.addEventListener('scroll', () => {
    const i = Math.round(pages.scrollLeft / pages.clientWidth);
    overlay.querySelectorAll('.bp-dots i').forEach((d, k) => d.classList.toggle('bp-on', k === i));
  }, { passive: true });

  function applyEye() {
    const h = new Date().getHours();
    const on = state.eye === 'on' || (state.eye === 'auto' && (h >= 19 || h < 7));
    phone.classList.toggle('bp-eye', on);
  }
  applyEye(); setInterval(applyEye, 60000);

  async function showSettings() {
    const c = currentChar(); const cur = await stage.get(c.key);
    sheet.querySelectorAll('[data-act="stage"]').forEach((b) => b.classList.toggle('on', b.dataset.v === cur));
    sheet.querySelectorAll('[data-act="eye"]').forEach((b) => b.classList.toggle('on', b.dataset.v === (state.eye || 'off')));
    const cityIn = sheet.querySelector('.bp-city-in'); if (cityIn && document.activeElement !== cityIn) cityIn.value = realwx.city.get();
    const sp = splashConf(); sheet.querySelectorAll('.bp-splash-in').forEach((i) => { i.value = sp[i.dataset.splash] || ''; });
    const box = sheet.querySelector('.bp-checkup');
    const eng = engines();
    const rows = [store.online() ? `✓ 連著 ${store.auth.get()?.phone || ''} 這支手機` : '！ 沒連上', brain.on ? `✓ 接著格本人（脆、IG、小遊戲這些字是他寫的，一則約一分鐘）${brain.why ? `，上次沒接到：${brain.why}` : ''}` : '・ 還沒接格本人，字由下面的 Google 金鑰寫', eng.gemini ? `✓ 有 Google 金鑰${keyRoute() ? `（走 ${keyRoute()}）` : ''}，他寫得了字、畫得了圖` : '！ 還沒貼 Google 金鑰：下面「腦子」貼一把', eng.gpt ? '✓ 有 OpenAI 金鑰（GPT 生圖）' : '・ 沒有 OpenAI 金鑰（可以不用）', '✓ 版本 ' + VERSION];
    sheet.querySelectorAll('.bp-key-in').forEach((i) => { if (document.activeElement === i) return; i.value = i.dataset.key === 'gemini' ? geminiKey.get() : i.dataset.key === 'openai' ? openaiKey.get() : textModelPref.get(); });
    sheet.querySelectorAll('[data-act="res"]').forEach((b) => b.classList.toggle('on', b.dataset.v === imageResPref.get()));
    box.innerHTML = `<ul>${rows.map((t) => `<li class="${t.startsWith('✓') ? 'ok' : 'bad'}">${escT(t)}</li>`).join('')}</ul>`;
  }
  sheet.addEventListener('change', (e) => {
    const k = e.target.closest('.bp-key-in');
    if (k) { const v = k.value.trim(); if (k.dataset.key === 'gemini') geminiKey.set(v); else if (k.dataset.key === 'openai') openaiKey.set(v); else textModelPref.set(v); showSettings(); say(v ? '存好了' : '拿掉了'); return; }
    const i = e.target.closest('.bp-city-in'); if (i) { realwx.city.set(i.value); lockWeather(); say(i.value.trim() ? '記住了，天氣馬上換' : '城市清掉了'); }
    const s = e.target.closest('.bp-splash-in'); if (s) { setSplash({ [s.dataset.splash]: s.value.trim() }); say('開機畫面改好了'); }
  });

  const goPage = (i) => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' });
  overlay.querySelectorAll('.bp-dots i').forEach((d, i) => d.addEventListener('click', () => goPage(i)));
  const curPage = () => Math.round(pages.scrollLeft / pages.clientWidth);
  let wheelLock = 0;
  pages.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const page = pages.children[curPage()];
    if (page && page.scrollHeight > page.clientHeight + 2) return;
    e.preventDefault();
    if (Date.now() - wheelLock < 600 || Math.abs(e.deltaY) < 8) return;
    wheelLock = Date.now();
    goPage(Math.max(0, Math.min(PAGES.length - 1, curPage() + (e.deltaY > 0 ? 1 : -1))));
  }, { passive: false });
  let drag = null; let dragged = false;
  pages.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, left: pages.scrollLeft }; dragged = false; });
  addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) { dragged = true; pages.style.scrollSnapType = 'none'; pages.scrollLeft = drag.left - dx; } });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; const from = Math.round(drag.left / pages.clientWidth);
    drag = null; pages.style.scrollSnapType = '';
    if (dragged) goPage(Math.max(0, Math.min(PAGES.length - 1, from + (dx < -40 ? 1 : dx > 40 ? -1 : 0))));
  });

  // App 畫面
  const appScreen = overlay.querySelector('.bp-appscreen');
  let current = null; let currentName = '';
  const openApp = (app, name = '') => { music?.leave(); current = app; currentName = name; appScreen.innerHTML = '<div class="bp-app-wait"><i></i><i></i><i></i></div>'; app.open(); appScreen.classList.add('bp-show'); phone.classList.add('bp-app-open'); };
  const closeApp = () => { appScreen.classList.remove('bp-show'); phone.classList.remove('bp-app-open'); current = null; currentName = ''; music?.leave(); refreshNotices?.(); };
  appScreen.addEventListener('bp-home', closeApp);
  const notes = createNotes({ screen: appScreen, say });
  const calendar = createCalendar({ screen: appScreen, say });
  const find = createFind({ screen: appScreen });
  const parcels = createParcels({ screen: appScreen, say, onChange: () => refreshNotices(), onOpen: (p) => logEvent('parcel-opened', { item: p.item, id: p.id }) });
  const threads = createThreads({ screen: appScreen, say });
  const ig = createIG({ screen: appScreen, say });
  const album = createAlbum({ screen: appScreen, say, onShare: async (img, text) => { await logEvent('share', { img, text: text || '' }); say('傳給他了，他在 Discord 那邊會看到'); }, onIG: (img, hint, id) => ig.postPhoto(img, hint, id) });
  const games = createGames({ screen: appScreen, say });
  const snap = { open: () => album.open('snap') };
  const his = createHisPhone({ host: overlay.querySelector('.bp-his'), say, onExit: () => say('還給他了，他沒發現') });
  const music = createMusic({ screen: appScreen, ytHost: overlay.querySelector('.bp-yt'), say });
  const APPS = { notes, calendar, find, parcel: parcels, threads, ig, album, game: games, camera: snap, music };

  // 她做了什麼（拆包裹、分享照片、改關係）：寫進 kv 的 events，格那邊讀得到
  async function logEvent(type, extra) { try { const list = ((await store.get('events')) || []).slice(-200); list.push({ id: Date.now().toString(36), type, ...extra, ts: Date.now() }); await store.set('events', list); } catch { /* 寫不進去就算了 */ } }

  // ---------- 鎖定畫面通知：格在 Discord 那邊寫的 kv notifs ----------
  let notifs = [];
  async function loadNotifs() { notifs = ((await store.get('notifs')) || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)); }
  loadNotifs().then(refreshNotices);
  const APP_ICON = (app) => ICON[{ parcel: 'parcel', calendar: 'calendar', notes: 'notes', find: 'find', ig: 'ig', album: 'album', music: 'music', game: 'game' }[app] || 'threads'];
  const APP_NAME = { threads: '脆', ig: 'Instagram', parcel: '包裹', calendar: '行事曆', notes: '便條', find: '尋找', album: '圖庫', music: '音樂', game: '小遊戲' };
  async function refreshNotices() {
    const list = notifs.filter((n) => !n.read);
    const unopened = await parcels.unopened().catch(() => 0);
    setBadge('parcel', unopened);
    for (const app of Object.keys(APP_NAME)) if (app !== 'parcel') setBadge(app, list.filter((n) => n.app === app).length);
    const hhmm = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    overlay.querySelector('.bp-notifs').innerHTML = list.slice(0, 4).map((n) => `<div class="bp-notif" data-act="notif" data-id="${escT(n.id)}">
      <i class="n-${escT(n.app || 'threads')}">${APP_ICON(n.app)}</i><div><b>${escT(n.title || APP_NAME[n.app] || '霧語')}</b><span>${escT(n.text || '')}</span></div><small>${hhmm(n.ts || Date.now())}</small></div>`).join('')
      + (list.length > 4 ? `<div class="bp-notif-more">還有 ${list.length - 4} 則</div>` : '');
  }
  async function markRead(app) {
    const hit = notifs.filter((n) => !n.read && n.app === app); if (!hit.length) return;
    for (const n of hit) n.read = true;
    try { const list = (await store.get('notifs')) || []; for (const n of list) if (hit.some((h) => h.id === n.id)) n.read = true; await store.set('notifs', list); } catch { /* 算了 */ }
    refreshNotices();
  }
  const openByName = (name) => {
    if (name === 'settings') { showSettings(); sheet.classList.add('bp-show'); return; }
    if (name === 'notes') { stage.get(currentChar().key).then((cur) => { if (!stage.unlocked(cur, 'notes')) say(`冰箱門要${stage.needFor('notes')}之後才有`); else openApp(notes, 'notes'); }); return; }
    const app = APPS[name];
    if (app) { openApp(app, name); markRead(name === 'parcel' ? 'parcel' : name); } else say('這個 App 還在做 ☁︎');
  };
  setInterval(refreshNotices, 60000);

  // 點擊
  phone.addEventListener('click', async (e) => {
    if (dragged) { dragged = false; return; }
    if (e.target.closest('.bp-appscreen, .bp-his')) return;
    const slot = e.target.closest('[data-slot]');
    if (slot) { pickTarget = slot.dataset.slot; file.click(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'splashbg') { pickTarget = 'splashbg'; file.click(); return; }
      if (a === 'splashprev') { showSplash(); setTimeout(hideSplash, 2600); return; }
      if (a === 'splashreset') { setSplash(null); sheet.querySelectorAll('.bp-splash-in').forEach((i) => { i.value = ''; }); say('開機畫面用回預設了'); return; }
      if (a === 'wall') { pickTarget = 'wall'; file.click(); }
      if (a === 'wall-reset') { const old = desk.wall; desk = { ...desk, wall: '' }; saveDesk(); dropImage(old); applyWall(); say('用回預設桌布了'); }
      if (a === 'photos-reset') { const old = Object.values(desk.photos); desk = { ...desk, photos: {} }; saveDesk(); old.forEach(dropImage); rebuild(); say('照片清掉了'); }
      if (a === 'close') sheet.classList.remove('bp-show');
      if (a === 'his') { sheet.classList.remove('bp-show'); his.open(); }
      if (a === 'stage') { await stage.set(currentChar().key, act.dataset.v); showSettings(); say(`關係改成「${stage.name(act.dataset.v)}」了`); logEvent('stage', { v: act.dataset.v }); }
      if (a === 'eye') { state.eye = act.dataset.v; save(state); applyEye(); showSettings(); }
      if (a === 'res') { imageResPref.set(act.dataset.v); showSettings(); }
      if (a === 'logout') { store.auth.set(null); location.reload(); }
      if (a === 'snap') { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); openApp(snap, 'camera'); }
      if (a === 'music') { lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); openApp(music, 'music'); }
      if (a === 'notif') { const n = notifs.find((x) => x.id === act.dataset.id); lock.classList.add('bp-gone'); phone.classList.remove('bp-locked'); openByName(n?.app && APPS[n.app] ? n.app : 'threads'); }
      return;
    }
    const mw = e.target.closest('[data-mw]');
    if (mw) { if (mw.dataset.mw === 'toggle') nowPlaying.toggle(); else nowPlaying.skip(mw.dataset.mw === 'next' ? 1 : -1); return; }
    const open = e.target.closest('[data-open]');
    if (open) { openByName(open.dataset.open); return; }
    if (e.target.closest('.bp-app-home')) { closeApp(); return; }
    if (e.target.closest('.bp-homebar')) { closeApp(); his.close(); lock.classList.remove('bp-gone'); phone.classList.add('bp-locked'); }
  });

  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = '';
    if (!f || !pickTarget) return;
    const target = pickTarget;
    say('照片放上去中⋯');
    const u = await uploadImage(await store.shrink(f, target === 'wall' || target === 'splashbg' ? 1290 : 900));
    if (!u) { say('照片存不上去，等一下再試'); return; }
    if (target === 'splashbg') { setSplash({ bg: u }); say('開機畫面的照片換好了'); return; }
    const old = target === 'wall' ? desk.wall : desk.photos[target];
    desk = { wall: desk.wall, photos: { ...desk.photos } };
    if (target === 'wall') desk.wall = u; else desk.photos[target] = u;
    await saveDesk();
    if (old && old !== u) dropImage(old);
    if (target === 'wall') { applyWall(); say('桌布換好了'); } else { rebuild(); say('放好了'); }
  });

  // 格那邊改了資料：開著的 App 重畫（正在打字就先不動）
  window.addEventListener('bp-store-late', (e) => {
    const k = String(e.detail || '');
    if (k.startsWith(DESK)) loadDesk();
    if (k.startsWith('cal:')) calDots();
    if (k.startsWith('weather') || k === 'realwx') lockWeather();
    if (k.startsWith('parcels')) refreshNotices();
    if (k === 'notifs') loadNotifs().then(refreshNotices);
    const typing = overlay.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (current && !typing && !appScreen.querySelector('.bp-ig-sheet, .bp-th-sheet, .bp-al-sheet')) current.open();
  });
  window.addEventListener('bp-profile', () => { rebuild(); if (current) current.open(); });

  async function calDots() {
    const evs = await data.cal.all(currentChar().key);
    const now = new Date(); const pre = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const has = new Set(evs.filter((x) => x.date.startsWith(pre)).map((x) => +x.date.slice(8)));
    overlay.querySelectorAll('.bp-cal-grid span:not(.bp-dow)').forEach((sp) => sp.classList.toggle('bp-ev', has.has(+sp.textContent)));
  }
  data.onChange((kind) => { if (kind === 'cal') calDots(); if (kind === 'weather') lockWeather(); });

  // 鎖定畫面的天氣：格那邊抓的真天氣；沒有就故事裡的
  let wxSeq = 0;
  async function lockWeather() {
    const el = overlay.querySelector('.bp-weather'); if (!el) return;
    const seq = ++wxSeq;
    let wx = await realwx.get().catch(() => null); let tag = wx ? `現實・${escT(wx.place || wx.city || '')}` : '';
    if (!wx) { wx = await data.weather.get(currentChar().key); tag = wx ? `故事・${escT(wx.city)}` : ''; }
    if (seq !== wxSeq) return;
    el.hidden = !wx;
    el.innerHTML = wx ? `<b>${skyIcon(wx.sky)} ${wx.temp != null ? `${wx.temp}°` : ''}</b><br>${escT(wx.sky)}<br>${tag}` : '';
  }

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
  const rebuild = () => { pages.innerHTML = PAGES.map((p) => `<div class="bp-page">${p.map(tile).join('')}</div>`).join(''); calDots(); };

  return {
    async open() {
      await store.whenReady(); await whenProfile();
      await loadDesk(); applyEye(); refreshNotices(); calDots(); lockWeather();
      lock.classList.remove('bp-gone'); phone.classList.add('bp-locked'); sheet.classList.remove('bp-show'); tick();
      overlay.classList.add('bp-open'); fit();
      if (store.auth.get()?.phone) { const dcu = (await store.get('dcurl')) || ''; if (dcu) try { localStorage.setItem('wuyu:dcurl', dcu); } catch { /* 存不了 */ } }
    },
  };
}

// ---------- 開機畫面 ----------
const SPLASH_KEY = 'brume-phone:splash';
function splashConf() { try { return JSON.parse(localStorage.getItem(SPLASH_KEY) || '{}'); } catch { return {}; } }
function setSplash(patch) {
  const cur = patch ? { ...splashConf(), ...patch } : {};
  try { localStorage.setItem(SPLASH_KEY, JSON.stringify(cur)); } catch { /* 存不了 */ }
}
function showSplash() {
  document.getElementById('bp-splash')?.remove();
  const sp = splashConf();
  const el = document.createElement('div'); el.id = 'bp-splash';
  if (sp.bg) el.style.setProperty('--bp-splash-bg', `url("${String(sp.bg).replace(/"/g, '%22')}")`);
  el.className = sp.bg ? 'has-bg' : '';
  el.innerHTML = `<div class="bp-splash-mist"></div><div class="bp-splash-txt"><b>${escT(sp.title || 'Brume')}</b><span>${escT(sp.line || '霧語')}</span></div><i class="bp-splash-dots"><u></u><u></u><u></u></i>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
}
function hideSplash() { const el = document.getElementById('bp-splash'); if (!el) return; el.classList.remove('on'); setTimeout(() => el.remove(), 700); }

function askPass(msg) {
  return new Promise((resolve) => {
    document.getElementById('bp-login')?.remove();
    const el = document.createElement('div'); el.id = 'bp-login';
    el.innerHTML = `<form><b>霧語</b><p>${escT(msg || '貼上格給妳的通行碼')}</p><input name="pass" placeholder="phone.通行碼" autocomplete="off" autocapitalize="none" spellcheck="false"><button>進去</button></form>`;
    document.body.appendChild(el);
    el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const p = store.parsePass(el.querySelector('input').value); if (!p) { el.querySelector('p').textContent = '通行碼長得不對，應該是 phone.一串字'; return; } el.remove(); resolve(p); });
    setTimeout(() => el.querySelector('input').focus(), 50);
  });
}
(async function init() {
  showSplash();
  const shownAt = Date.now();
  let ok = await store.connect();
  while (!ok) { const p = await askPass(ok === false && store.auth.get() ? '連不上，再試一次' : ''); ok = await store.connect(p); if (!ok) store.auth.set(null); }
  const phone = build();
  await phone.open();
  setTimeout(hideSplash, Math.max(250, 2500 - (Date.now() - shownAt)));
})();
