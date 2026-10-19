// 尋找、天氣、包裹（10/18 比比挑的三個）：資料都是正文的 <phone> 順手報的（life.js），不另外叫模型。

import { currentChar } from './st.js';
import * as data from './data.js';
import * as stage from './stage.js';
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

export function createFind({ screen }) {
  async function render() {
    const ch = currentChar();
    if (!ch) { screen.innerHTML = noChar('尋找'); return; }
    const cur = await stage.get(ch.key);
    if (!stage.unlocked(cur, 'find')) {
      screen.innerHTML = `<div class="bp-ap bp-ap-find">${head('尋找')}<p class="bp-ap-empty">${esc(ch.name)}還沒跟妳分享位置。<br>${stage.needFor('find')}之後就看得到他在哪。</p></div>`;
      return;
    }
    const w = await data.where.get(ch.key);
    const av = ch.avatar ? `<img src="${esc(ch.avatar)}" alt="">` : `<span>${esc(ch.name.slice(0, 1))}</span>`;
    screen.innerHTML = `<div class="bp-ap bp-ap-find">${head('尋找')}
      <div class="bp-find-map"><i class="r1"></i><i class="r2"></i><i class="r3"></i><i class="r4"></i><i class="park"></i>
        <div class="bp-find-pin${w ? '' : ' off'}"><u></u>${av}</div></div>
      <div class="bp-find-card">
        <b>${esc(ch.name)}</b>
        ${w ? `<span>📍 ${esc(w.place)}</span>${w.line ? `<p>${esc(w.line)}</p>` : ''}<small>劇情裡${w.day ? ` ${+w.day.slice(5, 7)}/${+w.day.slice(8)}` : ''} · ${ago(w.ts)}更新</small>`
        : `<p class="bp-ap-hint">還不知道他在哪。下一段劇情之後就會更新。</p>`}
      </div></div>`;
  }
  screen.addEventListener('click', (e) => home(screen, e, '.bp-ap-find'));
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
