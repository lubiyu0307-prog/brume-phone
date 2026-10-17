// 便條（冰箱門）與行事曆：他在 LINE 裡貼的、記的，都落在這兩個 App。

import { currentChar } from './st.js';
import * as data from './data.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function head(title, back = 'home') {
  return `<div class="bp-ap-head"><span class="bp-back" data-ap="${back}">‹</span><b>${title}</b><span></span></div>`;
}
const noChar = (title) => `<div class="bp-ap">${head(title)}<p class="bp-ap-empty">先在酒館選一個角色。</p></div>`;

export function createNotes({ screen, say }) {
  let ch = null;

  async function render() {
    ch = currentChar();
    if (!ch) { screen.innerHTML = noChar('便條'); return; }
    const ns = await data.notes.all(ch.key);
    screen.innerHTML = `<div class="bp-ap bp-ap-fridge">${head('冰箱門')}
      <div class="bp-ap-scroll">
        <div class="bp-ap-notes">
          ${ns.map((n, i) => `<div class="bp-ap-note ${n.by === 'him' ? 'him' : 'me'}${n.done ? ' done' : ''}" style="--r:${((i * 37) % 7) - 3}deg" data-toggle="${n.id}">
            <i class="pin"></i><p>${esc(n.text)}</p>
            <small>${n.by === 'him' ? esc(ch.name) : esc(ch.user)}${n.date ? `・${n.date.slice(5).replace('-', '/')}` : ''}</small>
            <u data-del="${n.id}">✕</u></div>`).join('')}
        </div>
        ${ns.length ? '<p class="bp-ap-hint">點便條打勾，點 ✕ 撕掉。</p>' : `<p class="bp-ap-empty">冰箱門上還沒有便條。<br>${esc(ch.name)}在 LINE 裡偶爾會貼一張給妳。</p>`}
      </div>
      <form class="bp-ap-add"><input placeholder="自己貼一張⋯" maxlength="40"><button>貼上</button></form>
    </div>`;
  }

  screen.addEventListener('click', async (e) => {
    if (!screen.querySelector('.bp-ap-fridge')) return;
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); await data.notes.remove(ch.key, del.dataset.del); render(); return; }
    const tg = e.target.closest('[data-toggle]');
    if (tg) { const n = (await data.notes.all(ch.key)).find((x) => x.id === tg.dataset.toggle); if (n) await data.notes.update(ch.key, n.id, { done: !n.done }); render(); return; }
    if (e.target.closest('[data-ap="home"]')) screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
  });
  screen.addEventListener('submit', async (e) => {
    if (!screen.querySelector('.bp-ap-fridge')) return;
    e.preventDefault();
    const inp = screen.querySelector('.bp-ap-add input'); const text = inp.value.trim();
    if (!text || !ch) return;
    await data.notes.add(ch.key, { text, by: 'me' }); say('貼上去了'); render();
  });

  return { open: render };
}

export function createCalendar({ screen, say }) {
  let ch = null;
  const now = new Date();
  let y = now.getFullYear(); let m = now.getMonth(); let sel = data.today();
  // 兩本：劇情（故事裡的日子，「今天」是劇情日期）和現實（真的日曆）
  let tab = 'story'; let tday = data.today();
  async function goTab(t) {
    tab = t; ch = currentChar();
    tday = tab === 'story' && ch ? ((await data.storyDay.get(ch.key)) || data.today()) : data.today();
    const d = new Date(tday); y = d.getFullYear(); m = d.getMonth(); sel = tday;
    render();
  }

  async function render() {
    ch = currentChar();
    if (!ch) { screen.innerHTML = noChar('行事曆'); return; }
    const evs = (await data.cal.all(ch.key)).filter((e) => data.calKind(e) === tab);
    const has = new Set(evs.map((e) => e.date));
    const first = new Date(y, m, 1).getDay(); const days = new Date(y, m + 1, 0).getDate();
    let cells = WEEK.map((w) => `<span class="dow">${w}</span>`).join('');
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const k = ymd(y, m, d);
      cells += `<span data-day="${k}" class="${k === tday ? 'today' : ''}${k === sel ? ' sel' : ''}">${d}${has.has(k) ? '<i></i>' : ''}</span>`;
    }
    const dayEvs = evs.filter((e) => e.date === sel);
    // 接下來：今天以後的所有安排，上面選的那天已經列過的不重複
    const upcoming = evs.filter((e) => e.date >= tday && e.date !== sel).slice(0, 8);
    screen.innerHTML = `<div class="bp-ap bp-ap-cal">${head('行事曆')}
      <div class="bp-ap-scroll">
        <div class="bp-ap-tabs">${[['story', '劇情'], ['real', '現實']].map(([v, n]) => `<b data-caltab="${v}" class="${tab === v ? 'on' : ''}">${n}</b>`).join('')}</div>
        <p class="bp-ap-hint">${tab === 'story' ? `故事裡的日子${tday !== data.today() ? `，劇情裡的今天是 ${tday.slice(0, 4)}/${+tday.slice(5, 7)}/${+tday.slice(8)}` : ''}。他在劇情裡記的都在這本。` : '真的日曆。在 LINE 用現實時間聊天時約好的事記在這本。'}</p>
        <div class="bp-ap-month"><i data-mon="-1">‹</i><b>${y} 年 ${m + 1} 月</b><i data-mon="1">›</i></div>
        <div class="bp-ap-grid">${cells}</div>
        <h4>${sel.slice(5).replace('-', '/')}（${WEEK[new Date(sel).getDay()]}）</h4>
        ${dayEvs.length ? dayEvs.map(ev).join('') : '<p class="bp-ap-hint">這天沒有安排。</p>'}
        <form class="bp-ap-add inline"><input placeholder="在這天加一件事⋯" maxlength="24"><button>加</button></form>
        <h4>之後的安排</h4>
        ${upcoming.length ? upcoming.map((e) => ev(e, true)).join('') : `<p class="bp-ap-hint">${evs.some((e) => e.date >= tday) ? '其他天還沒有安排。' : `還沒有安排。跟${esc(ch.name)}約好的事，他會記上來。`}</p>`}
      </div></div>`;
  }

  function ev(e, withDate) {
    return `<div class="bp-ap-ev ${e.by === 'him' ? 'him' : 'me'}">${withDate ? `<em>${e.date.slice(5).replace('-', '/')}</em>` : ''}<span>${esc(e.title)}</span><small>${e.by === 'him' ? esc(ch.name) : esc(ch.user)}</small><u data-evdel="${e.id}">✕</u></div>`;
  }

  screen.addEventListener('click', async (e) => {
    if (!screen.querySelector('.bp-ap-cal')) return;
    const tb = e.target.closest('[data-caltab]'); if (tb) { goTab(tb.dataset.caltab); return; }
    const day = e.target.closest('[data-day]'); if (day) { sel = day.dataset.day; render(); return; }
    const mon = e.target.closest('[data-mon]');
    if (mon) { m += +mon.dataset.mon; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } render(); return; }
    const del = e.target.closest('[data-evdel]'); if (del) { await data.cal.remove(ch.key, del.dataset.evdel); render(); return; }
    if (e.target.closest('[data-ap="home"]')) screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
  });
  screen.addEventListener('submit', async (e) => {
    if (!screen.querySelector('.bp-ap-cal')) return;
    e.preventDefault();
    const inp = screen.querySelector('.bp-ap-add input'); const title = inp.value.trim();
    if (!title || !ch) return;
    await data.cal.add(ch.key, { date: sel, title, by: 'me', kind: tab }); say('記上去了'); render();
  });

  return { open() { goTab(tab); } };
}
