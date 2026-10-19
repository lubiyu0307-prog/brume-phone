// 尋找、天氣、包裹（10/18 比比挑的三個）：資料都是正文的 <phone> 順手報的（life.js），不另外叫模型。

import { currentChar } from './st.js';
import * as data from './data.js';
import * as stage from './stage.js';
import * as realwx from './realwx.js';
import * as routine from './routine.js';
import { giftEmoji } from './line.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const head = (title) => `<div class="bp-ap-head"><span class="bp-back" data-ap="home">‹</span><b>${title}</b><span></span></div>`;
const noChar = (title) => `<div class="bp-ap">${head(title)}<p class="bp-ap-empty">先在酒館選一個角色。</p></div>`;
const ago = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`;
};
const home = (screen, e, cls) => { if (screen.querySelector(cls) && e.target.closest('[data-ap="home"]')) screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true })); };

// 天氣字 → 圖示（給天氣 App 和鎖定畫面）
const SKY = [[/雷/, '⛈'], [/雪/, '❄︎'], [/雨/, '☂︎'], [/霧|霾/, '≋'], [/陰|雲/, '☁︎'], [/晴|太陽/, '☀︎']];
export const skyIcon = (sky) => (SKY.find(([re]) => re.test(sky || '')) || [0, '☁︎'])[1];

// ---------- 尋找 ----------
// 10/19 比比要的：地圖要有他生活的痕跡。劇情／現實兩個模式：
//   劇情：每張卡自己長一張街區（種子＝角色卡，每次開都一樣），正文報過的地方釘成地標，他的點在地標之間移動，今天去過的畫成足跡
//   現實：真地圖（Leaflet＋OpenStreetMap，不用金鑰），中心是玩家填的現實城市，他在 LINE 現實模式傳的位置釘上去
//   卡片仿 Find My：離妳多遠、他手機電量、幾分鐘前更新——距離跟電量是照地名跟時間算出來的假數字，但每次開都一樣，不會跳來跳去
const FIND_MODE = 'brume-phone:findmode';
const findMode = {
  get() { try { return localStorage.getItem(FIND_MODE) === 'real' ? 'real' : 'story'; } catch { return 'story'; } },
  set(v) { try { localStorage.setItem(FIND_MODE, v === 'real' ? 'real' : 'story'); } catch { /* 存不了 */ } },
};
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const rnd = (seed) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
// 地名 → 地標種類（決定圖示跟哪個算「家」）
const KIND = [
  ['her', /她家|妳家|她的家|妳的家|她的房間|妳的房間|她的公寓|妳的公寓/],
  ['home', /家|公寓|宿舍|房間|臥室|住處|套房|租屋|客廳|廚房|陽台|浴室/],
  ['work', /公司|辦公室|工作室|事務所|醫院|診所|學校|大學|教室|研究室|實驗室|工廠|工地|店裡|店內|櫃檯|後台|片場|劇組|分局|警局|消防|書店|畫室|工房/],
  ['transit', /捷運|車站|火車|高鐵|機場|公車|轉運|月台|碼頭/],
  ['food', /咖啡|餐廳|小吃|麵|飯|食堂|酒吧|居酒屋|市場|超市|便利商店|超商|早餐|宵夜|甜點|麵包|茶|火鍋|燒烤|攤/],
  ['park', /公園|河堤|河邊|海邊|海灘|沙灘|山|步道|湖|森林|廣場|操場|球場|堤防|草地/],
];
const kindOf = (place, userName) => {
  if (userName && place.includes(userName) && /家|房|住/.test(place)) return 'her';
  return (KIND.find(([, re]) => re.test(place)) || ['other'])[0];
};
const KIND_ICON = { her: '🏠', home: '🏡', work: '💼', transit: '🚉', food: '☕️', park: '🌳', other: '📍' };
const ROADS = ['中正路', '民生路', '和平街', '自由路', '光復路', '河堤路', '學府路', '青田街', '文化路', '仁愛路', '信義街', '博愛路', '復興路', '中華路', '大同街', '育英路'];

/** 一張卡自己的街區：回 { roads, park, river, station, pos(place) }，座標都是 0–100 的百分比 */
function cityOf(seed) {
  const r = rnd(hash(seed));
  const names = [...ROADS].sort(() => r() - 0.5).slice(0, 4);
  const roads = [
    { x1: -5, y1: 30 + r() * 20, x2: 105, y2: 30 + r() * 20, w: 3.2, name: names[0] },
    { x1: -5, y1: 62 + r() * 18, x2: 105, y2: 62 + r() * 18, w: 2.2, name: names[1] },
    { x1: 22 + r() * 16, y1: -5, x2: 22 + r() * 16, y2: 105, w: 2.6, name: names[2] },
    { x1: 62 + r() * 18, y1: -5, x2: 62 + r() * 18, y2: 105, w: 2, name: names[3] },
  ];
  const river = r() < 0.7 ? { y: 8 + r() * 12, bend: (r() - 0.5) * 14 } : null;
  const park = { x: 8 + r() * 60, y: 14 + r() * 60, w: 16 + r() * 10, h: 10 + r() * 8 };
  const station = { x: 12 + r() * 76, y: 86 - r() * 6 };
  const taken = [];
  // 地標位置照地名算，同一個地名永遠在同一格；太靠近別的地標就往旁邊挪
  const pos = (place) => {
    const q = rnd(hash(seed + '|' + place));
    let x = 12 + q() * 76; let y = 14 + q() * 68;
    for (let k = 0; k < 12; k++) {
      const near = taken.find((t) => Math.hypot(t.x - x, t.y - y) < 16);
      if (!near) break;
      x = 12 + ((x + 23 + q() * 20) % 76); y = 14 + ((y + 17 + q() * 14) % 68);
    }
    const p = { x, y }; taken.push(p); return p;
  };
  return { roads, river, park, station, pos };
}

export function createFind({ screen }) {
  let map = null; // Leaflet 的地圖（現實模式）
  const dayOf = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const hm = (ts) => { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const seg = (mode) => `<div class="bp-find-seg">${[['story', '劇情'], ['real', '現實']].map(([v, n]) => `<b data-find="mode" data-v="${v}" class="${mode === v ? 'on' : ''}">${n}</b>`).join('')}</div>`;
  const headFind = (mode) => `<div class="bp-ap-head"><span class="bp-back" data-ap="home">‹</span><b>尋找</b><span></span></div>${seg(mode)}`;

  // 卡片（兩個模式共用）：Find My 的樣子
  function card(ch, w, log, real) {
    if (!w) return `<div class="bp-find-card"><b>${esc(ch.name)}</b><p class="bp-ap-hint">${real ? '還在照角色卡整理他平常的作息，等一下再開一次就看得到他在哪。' : '還不知道他在哪。下一段劇情之後就會更新。'}</p></div>`;
    const h = hash(w.place);
    const kind = kindOf(w.place, ch.user);
    // 「離妳幾公里」是假數字，抱著她在沙發上也會算出 6.7 km（10/19 比比抓到）。改成看得懂的狀態
    const text = `${w.place} ${w.line || ''}`;
    const withHer = kind === 'her' || (ch.user && text.includes(ch.user)) || /一起|妳|她|抱|陪|身邊|旁邊|兩人|牽/.test(text);
    const state = withHer ? '跟妳在一起' : kind === 'home' ? '在家' : kind === 'work' ? '上班中' : kind === 'transit' ? '在路上' : kind === 'food' ? '在外面吃東西' : kind === 'park' ? '在外面走走' : '在外面';
    const hour = new Date().getHours();
    const batt = Math.max(8, 100 - ((hour * 6 + (h % 23)) % 78));
    const today = real ? dayOf(Date.now()) : w.day;
    const trail = log.filter((x) => (real ? dayOf(x.ts) : x.day) === today && x.ts <= Date.now());
    const trailHtml = trail.length > 1 ? `<div class="bp-find-trail"><small>今天</small>${trail.map((x, i) => `<span>${i ? '<i>›</i>' : ''}${esc(x.place)}${real ? `<em>${hm(x.ts)}</em>` : ''}</span>`).join('')}</div>` : '';
    return `<div class="bp-find-card">
      <b>${esc(ch.name)}</b>
      <span>${KIND_ICON[kind]} ${esc(w.place)}</span>${w.line ? `<p>${esc(w.line)}</p>` : ''}
      <div class="bp-find-stats"><i>${state}</i><i>🔋 ${batt}%</i><i>${w.auto ? '照他的作息' : `${ago(w.ts)}更新`}</i></div>
      ${trailHtml}
      <small>${real ? (w.auto ? '現實時間 · 照他平常的作息算的，他在 LINE 傳位置會以那個為準' : '現實時間 · 他傳的位置') : `劇情裡${w.day ? ` ${+w.day.slice(5, 7)}/${+w.day.slice(8)}` : ''}`}</small>
    </div>`;
  }

  // 劇情模式：自己長的街區（SVG）
  function storyMap(ch, w, log) {
    const city = cityOf(ch.charKey || ch.key);
    const places = [...new Map(log.map((x) => [x.place, x])).values()];
    if (w && !places.some((x) => x.place === w.place)) places.push(w);
    const pts = places.map((x) => ({ ...x, kind: kindOf(x.place, ch.user), ...city.pos(x.place) }));
    const cur = w ? pts.find((x) => x.place === w.place) : null;
    const today = w?.day;
    const trail = today ? log.filter((x) => x.day === today).map((x) => pts.find((p) => p.place === x.place)).filter(Boolean) : [];
    const road = (r) => `<line x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}" stroke="#fbfaf6" stroke-width="${r.w}" stroke-linecap="round"/>`;
    const label = (r) => (r.y1 === r.y2
      ? `<text x="4" y="${r.y1 - 1.6}" font-size="2.6" fill="#9a9488">${esc(r.name)}</text>`
      : `<text x="${r.x1 + 1.6}" y="96" font-size="2.6" fill="#9a9488" transform="rotate(-90 ${r.x1 + 1.6} 96)">${esc(r.name)}</text>`);
    const av = ch.avatar ? `<img src="${esc(ch.avatar)}" alt="">` : `<span>${esc(ch.name.slice(0, 1))}</span>`;
    return `<div class="bp-find-map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        ${city.river ? `<path d="M-5 ${city.river.y} C 30 ${city.river.y + city.river.bend}, 70 ${city.river.y - city.river.bend}, 105 ${city.river.y}" stroke="#bfd4de" stroke-width="5" fill="none"/>` : ''}
        <rect x="${city.park.x}" y="${city.park.y}" width="${city.park.w}" height="${city.park.h}" rx="4" fill="#cfdcc0"/>
        ${city.roads.map(road).join('')}${city.roads.map(label).join('')}
        <rect x="${city.station.x - 2.5}" y="${city.station.y - 1.6}" width="5" height="3.2" rx=".8" fill="#d8d2c6"/>
        ${trail.length > 1 ? `<polyline points="${trail.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#c98b5a" stroke-width=".9" stroke-dasharray="1.6 1.6" stroke-linejoin="round"/>` : ''}
      </svg>
      ${pts.map((p) => `<div class="bp-find-lm${p === cur ? ' cur' : ''} k-${p.kind}" style="left:${p.x}%;top:${p.y}%"><i>${KIND_ICON[p.kind]}</i><small>${esc(p.place)}</small></div>`).join('')}
      <div class="bp-find-pin${cur ? '' : ' off'}" style="left:${cur ? cur.x : 50}%;top:${cur ? cur.y : 50}%"><u></u>${av}</div>
    </div>`;
  }

  // 現實模式：Leaflet 真地圖。中心是玩家填的現實城市，他的點照地名在市中心附近挪一點（不是真的定位）
  let leafletLoading = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletLoading) return leafletLoading;
    leafletLoading = new Promise((res, rej) => {
      if (!document.querySelector('link[data-bp-leaflet]')) {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; css.dataset.bpLeaflet = '1'; document.head.appendChild(css);
      }
      const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; s.onerror = () => { leafletLoading = null; rej(new Error('地圖載不進來')); }; document.head.appendChild(s);
    });
    return leafletLoading;
  }
  const jitter = (place, base, span) => { const q = rnd(hash('geo|' + place)); return [base.lat + (q() - 0.5) * span, base.lon + (q() - 0.5) * span * 1.2]; };
  async function realMap(ch, w, log, box) {
    const cityName = realwx.city.get();
    if (!cityName) { box.innerHTML = '<p class="bp-find-mapnote">還沒填現實的城市。到手機的設定 →「你們」填一次，這裡就會有真的地圖。</p>'; return; }
    box.innerHTML = '<p class="bp-find-mapnote">地圖載入中⋯</p>';
    let base = null;
    try { await loadLeaflet(); base = await realwx.coords(cityName); } catch (e) { box.innerHTML = `<p class="bp-find-mapnote">${esc(e.message || '地圖載不進來')}</p>`; return; }
    if (!base) { box.innerHTML = `<p class="bp-find-mapnote">找不到「${esc(cityName)}」這個城市，到設定改一下名字。</p>`; return; }
    if (!box.isConnected) return;
    box.innerHTML = '<div class="bp-find-leaflet"></div>';
    const el = box.querySelector('.bp-find-leaflet');
    const L = window.L;
    map?.remove(); map = L.map(el, { zoomControl: false, attributionControl: true }).setView([base.lat, base.lon], 14);
    // CARTO 的圖磚 10/19 起要金鑰，改用 OpenStreetMap 本家（免費、不用鑰匙，流量小用沒問題）
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const places = [...new Map(log.map((x) => [x.place, x])).values()];
    if (w && !places.some((x) => x.place === w.place)) places.push(w);
    const pts = [];
    for (const x of places) {
      const ll = jitter(x.place, base, 0.03); pts.push({ ...x, ll });
      const kind = kindOf(x.place, ch.user);
      L.marker(ll, { icon: L.divIcon({ className: 'bp-find-lmi', html: `<i>${KIND_ICON[kind]}</i><small>${esc(x.place)}</small>`, iconSize: [0, 0] }) }).addTo(map);
    }
    const today = dayOf(Date.now());
    const trail = log.filter((x) => dayOf(x.ts) === today && x.ts <= Date.now()).map((x) => pts.find((p) => p.place === x.place)?.ll).filter(Boolean);
    if (trail.length > 1) L.polyline(trail, { color: '#c98b5a', weight: 2.5, dashArray: '5 6' }).addTo(map);
    const cur = w ? pts.find((p) => p.place === w.place) : null;
    const av = ch.avatar ? `<img src="${esc(ch.avatar)}" alt="">` : `<span>${esc(ch.name.slice(0, 1))}</span>`;
    L.marker(cur ? cur.ll : [base.lat, base.lon], { icon: L.divIcon({ className: 'bp-find-pinw', html: `<div class="bp-find-pin${cur ? '' : ' off'}"><u></u>${av}</div>`, iconSize: [0, 0] }), zIndexOffset: 1000 }).addTo(map);
    if (cur) map.setView(cur.ll, 15);
    setTimeout(() => map?.invalidateSize(), 60);
  }

  async function render() {
    const ch = currentChar();
    if (!ch) { screen.innerHTML = noChar('尋找'); return; }
    const cur = await stage.get(ch.key);
    if (!stage.unlocked(cur, 'find')) {
      screen.innerHTML = `<div class="bp-ap bp-ap-find">${head('尋找')}<p class="bp-ap-empty">${esc(ch.name)}還沒跟妳分享位置。<br>${stage.needFor('find')}之後就看得到他在哪。</p></div>`;
      return;
    }
    const mode = findMode.get(); const real = mode === 'real';
    const [w, all, r] = await Promise.all([real ? routine.whereNow(ch) : data.where.get(ch.key), data.whereLog.all(ch.key), real ? routine.routineOf(ch) : null]);
    // 現實：作息表今天的每一段當成足跡（還沒到的那幾段只當地標），他在 LINE 傳的也算進去
    const log = real
      ? [...routine.todayItems(r).map((x) => ({ place: x.place, line: x.doing, day: data.today(), ts: x.ts, kind: 'real' })), ...all.filter((x) => x.kind === 'real')].sort((a, b) => a.ts - b.ts)
      : all.filter((x) => x.kind !== 'real');
    map?.remove(); map = null;
    screen.innerHTML = `<div class="bp-ap bp-ap-find">${headFind(mode)}
      ${real ? '<div class="bp-find-map bp-find-real"></div>' : storyMap(ch, w, log)}
      ${card(ch, w, log, real)}</div>`;
    if (real) realMap(ch, w, log, screen.querySelector('.bp-find-real'));
  }
  screen.addEventListener('click', (e) => {
    home(screen, e, '.bp-ap-find');
    const m = e.target.closest('[data-find="mode"]'); if (m && screen.querySelector('.bp-ap-find')) { findMode.set(m.dataset.v); render(); }
  });
  return { open: render };
}

export function createWeather({ screen }) {
  async function render() {
    const ch = currentChar();
    if (!ch) { screen.innerHTML = noChar('天氣'); return; }
    const wx = await data.weather.get(ch.key);
    const rainy = /雨|雷|雪/.test(wx?.sky || '');
    screen.innerHTML = `<div class="bp-ap bp-ap-wx${rainy ? ' rain' : /晴/.test(wx?.sky || '') ? ' sun' : ''}">${head('天氣')}
      ${wx ? `<div class="bp-wx-main">
          <small>${esc(wx.city)}</small>
          <b>${wx.temp != null ? `${wx.temp}°` : '—'}</b>
          <span>${skyIcon(wx.sky)} ${esc(wx.sky)}</span>
          <em>故事裡${wx.day ? ` ${+wx.day.slice(5, 7)}/${+wx.day.slice(8)}` : ''}的天氣 · ${ago(wx.ts)}更新</em>
        </div>
        ${rainy ? `<p class="bp-wx-tip">${esc(ch.name)}大概會問妳有沒有帶傘。</p>` : ''}`
      : '<p class="bp-ap-empty">還沒有天氣。<br>下一段劇情之後，這裡會是故事裡那座城市的天氣。</p>'}
    </div>`;
  }
  screen.addEventListener('click', (e) => home(screen, e, '.bp-ap-wx'));
  return { open: render };
}

export function createParcels({ screen, say, onChange, onOpen }) {
  let ch = null;
  async function render() {
    ch = currentChar();
    if (!ch) { screen.innerHTML = noChar('包裹'); return; }
    const ps = await data.parcels.all(ch.key);
    const now = Date.now();
    screen.innerHTML = `<div class="bp-ap bp-ap-parcel">${head('包裹')}<div class="bp-ap-scroll">
      ${ps.length ? ps.map((p) => {
        const coming = p.eta > now;
        const open = p.opened && !coming;
        return `<div class="bp-parcel${coming ? ' coming' : open ? ' open' : ''}" data-parcel="${p.id}">
          <i>${open ? giftEmoji(p.item) : '📦'}</i>
          <div><b>${coming ? '配送中' : open ? esc(p.item) : '送到了，點一下拆開'}</b>
          ${open && p.note ? `<p>「${esc(p.note)}」</p>` : ''}
          <small>${coming ? `預計 ${Math.max(1, Math.round((p.eta - now) / 60000))} 分鐘後送到` : `${esc(ch.name)} · ${ago(p.eta || p.ts)}`}</small></div></div>`;
      }).join('') : `<p class="bp-ap-empty">還沒有包裹。<br>你們分開的時候，${esc(ch.name)}偶爾會幫妳叫外送、寄東西過來。</p>`}
    </div></div>`;
  }
  screen.addEventListener('click', async (e) => {
    if (!screen.querySelector('.bp-ap-parcel')) return;
    home(screen, e, '.bp-ap-parcel');
    const el = e.target.closest('[data-parcel]'); if (!el || !ch) return;
    const p = (await data.parcels.all(ch.key)).find((x) => x.id === el.dataset.parcel);
    if (!p) return;
    if (p.eta > Date.now()) { say('還在路上，等一下'); return; }
    if (!p.opened) { await data.parcels.update(ch.key, p.id, { opened: true }); say(`拆開了：${p.item}`); onChange?.(); render(); onOpen?.(p); } // 拆開了他會接著問（10/19 比比：少一個回圈）
  });
  return {
    open: render,
    /** 送到了還沒拆的有幾個（圖示紅點） */
    async unopened() { const c = currentChar(); if (!c) return 0; const now = Date.now(); return (await data.parcels.all(c.key)).filter((p) => !p.opened && p.eta <= now).length; },
  };
}
