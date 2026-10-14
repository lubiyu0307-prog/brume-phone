// 相本＋快照：挑一段正文，寫成照片；接了生圖就直接出圖，沒接就給 prompt 拿去外面生，生好再傳回來。
// 「證件照」分頁放他、妳、配角的參考照片和長相，每張快照都帶著，同一個人才不會每張長得不一樣。

import * as store from './store.js';
import { currentChar, generate, imagine, recentChat } from './st.js';
import { HIM, ME, loadCast, saveCast, person, setPerson, sideNames, refsFor, idsFor, finalPrompt } from './cast.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const day = (ts) => { const d = new Date(ts); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

function parseJSON(raw) {
  const t = raw.replace(/```(?:json)?/gi, '');
  const i = t.indexOf('{'); const j = t.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('沒有生出內容');
  return JSON.parse(t.slice(i, j + 1));
}

const IC = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
};

export function createAlbum({ screen, say, onShare, onIG }) {
  let ch = null; let items = []; let people = { cast: {}, look: { him: '', me: '' } }; let editing = null; // editing：證件照正在改的那個人
  let view = 'grid'; let tab = 'all'; let openId = null; let picked = new Set(); let busy = false; let note = '';
  const mine = () => !!screen.querySelector('.bp-al');
  const save = () => ch && store.set('album:' + ch.key, items).catch(() => {});

  async function load() {
    ch = currentChar();
    if (!ch) return false;
    items = (await store.get('album:' + ch.key).catch(() => null)) || [];
    people = await loadCast(ch.charKey);
    return true;
  }

  // LINE 裡傳過的照片也算在相本裡
  async function chatPhotos() {
    const t = (await store.get('line:' + ch.key).catch(() => null)) || { msgs: [] };
    return t.msgs.filter((m) => m.img).map((m) => ({ id: 'line-' + m.id, img: m.img, desc: m.me ? '妳在 LINE 傳的照片' : `${ch.name}在 LINE 傳的照片`, ts: m.ts, source: 'line' }));
  }

  function tile(p) {
    return p.img
      ? `<div class="bp-al-tile" data-photo="${p.id}"><img src="${esc(p.img)}" alt="" loading="lazy"></div>`
      : `<div class="bp-al-tile card" data-photo="${p.id}" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span></div>`;
  }

  const TABS = [['all', '全部'], ['snap', '快照'], ['line', '聊天'], ['mine', '我放的'], ['id', '證件照']];
  const tabBar = () => `<div class="bp-al-tabs">${TABS.map(([k, n]) => `<span data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</span>`).join('')}</div>`;

  function head(title, back = 'home', right = '') {
    return `<div class="bp-al-head"><span class="bp-back" data-al="${back}">‹</span><b>${title}</b><span>${right}</span></div>`;
  }

  async function render() {
    if (!ch && !(await load())) { screen.innerHTML = `<div class="bp-al">${head('相本')}<p class="bp-al-empty">先在酒館選一個角色。</p></div>`; return; }
    if (view === 'snap') return renderSnap();
    if (view === 'person') return renderPerson();
    if (tab === 'id') return renderIds();
    if (view === 'one') return renderOne();
    const line = await chatPhotos();
    const all = [...items, ...line].sort((a, b) => b.ts - a.ts);
    const shown = tab === 'snap' ? all.filter((p) => p.source === 'snap') : tab === 'line' ? line : tab === 'mine' ? all.filter((p) => p.source === 'upload') : all;
    screen.innerHTML = `<div class="bp-al">${head('相本', 'home', `<i data-al="upload" class="bp-al-up" title="放照片">${IC.up}<small>放照片</small></i>`)}
      ${tabBar()}
      <div class="bp-al-scroll">
        ${shown.length ? `<div class="bp-al-grid">${shown.map(tile).join('')}</div>` : `<p class="bp-al-empty">${tab === 'snap' || tab === 'all' ? '還沒有快照。<br>按右下角的相機，挑一段劇情拍下來。' : tab === 'mine' ? '還沒有放照片。<br>按右上角的「放照片」，一次可以選好幾張。' : '這裡還沒有照片。'}</p>`}
      </div>
      <button class="bp-al-fab" data-al="snap">${IC.cam}</button>
      <input class="bp-al-file" type="file" accept="image/*" multiple hidden>
    </div>`;
  }

  async function renderOne() {
    const all = [...items, ...(await chatPhotos())];
    const p = all.find((x) => x.id === openId);
    if (!p) { view = 'grid'; return render(); }
    const own = !String(p.id).startsWith('line-');
    screen.innerHTML = `<div class="bp-al bp-al-dark">${head(day(p.ts), 'grid')}
      <div class="bp-al-scroll">
        ${p.img ? `<img class="bp-al-big" src="${esc(p.img)}" alt="">` : `<div class="bp-al-bigcard" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span></div>`}
        ${own && p.source === 'upload' ? `<input class="bp-al-cap" value="${esc(p.desc === '妳放的照片' ? '' : p.desc)}" placeholder="寫一句話（例如：第一次一起去海邊）" maxlength="60">` : `<p class="bp-al-desc">${esc(p.desc)}</p>`}
        ${p.scene ? `<details class="bp-al-scene"><summary>這一幕</summary><p>${esc(p.scene)}</p></details>` : ''}
        ${p.prompt ? `<div class="bp-al-prompt"><small>生圖 prompt</small><p>${esc(p.prompt)}</p><button data-al="copy">複製</button></div>` : ''}
        ${own ? `<div class="bp-al-acts">
          ${p.prompt && !p.img ? '<button data-al="gen">用酒館生圖</button>' : ''}
          ${p.prompt ? '<button data-al="regen">重新生一張</button>' : ''}
          ${p.img && onShare ? '<button data-al="share">傳到 LINE 給他看</button>' : ''}
          ${p.img && onIG ? `<button data-al="ig" ${busy ? 'disabled' : ''}>${busy === 'ig' ? '他在想要寫什麼⋯' : '請他發到 IG'}</button>` : ''}
          <button data-al="attach">${p.img ? '換一張圖' : '傳生好的圖進來'}</button>
          <button data-al="del" class="danger">刪除</button></div>` : ''}
        <p class="bp-al-note">${esc(note)}</p>
      </div>
      <input class="bp-al-file" type="file" accept="image/*" hidden>
    </div>`;
  }

  function renderSnap() {
    const chat = recentChat(12).reverse();
    screen.innerHTML = `<div class="bp-al">${head('快照', 'grid', '<i data-al="ids" title="證件照">證件照</i>')}
      <div class="bp-al-scroll">
        <p class="bp-al-hint">挑一到三段劇情，拍成一張照片。${person(people, ch, HIM).photo || people.look.him ? '' : '<br><u data-al="ids">先到證件照放他的照片</u>，照片裡的他才會每張都一樣。'}</p>
        ${chat.length ? chat.map((m) => `<div class="bp-al-pick${picked.has(m.i) ? ' on' : ''}" data-pick="${m.i}"><b>${esc(m.who)}</b><p>${esc(m.text.slice(0, 160))}${m.text.length > 160 ? '⋯' : ''}</p></div>`).join('') : '<p class="bp-al-empty">正文還沒有內容。</p>'}
        <textarea class="bp-al-extra" rows="2" placeholder="想特別拍什麼？（可以不寫）"></textarea>
      </div>
      <div class="bp-al-bar"><button data-al="shoot" ${busy ? 'disabled' : ''}>${busy ? '拍照中⋯' : `拍下來${picked.size ? `（${picked.size} 段）` : ''}`}</button></div>
    </div>`;
  }

  // 證件照：他、妳、配角各一格。照片給生圖當參考，長相文字寫進 prompt
  function renderIds() {
    const card = (id) => {
      const p = person(people, ch, id);
      const role = id === HIM ? '主角' : id === ME ? '妳' : '配角';
      return `<div class="bp-al-id" data-person="${esc(id)}">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span class="bp-al-idnone" style="--h:${hue(p.name)}">${esc(p.name.slice(0, 1))}</span>`}<b>${esc(p.name)}</b><small>${role}${p.photo ? '' : '・還沒放照片'}</small></div>`;
    };
    screen.innerHTML = `<div class="bp-al">${head('相本', 'home')}${tabBar()}
      <div class="bp-al-scroll">
        <p class="bp-al-hint">放每個人的參考照片，快照和 IG 生圖時會拿給 Gemini 看，同一個人才會每張都長一樣。配角的照片也是他在 IG 的大頭貼。</p>
        <div class="bp-al-ids">${[HIM, ME, ...sideNames(people)].map(card).join('')}<div class="bp-al-id add" data-person=""><span class="bp-al-idnone">＋</span><b>加配角</b><small>名字要跟劇情裡一樣</small></div></div>
        <label>照片風格（每張生圖都會套用，可以不寫）</label>
        <textarea class="bp-al-style" rows="3" placeholder="例如：film photo, warm tone, soft grain／日系清新、低飽和／韓系冷白、柔焦">${esc(people.look.style)}</textarea>
        <p class="bp-al-hint">濾鏡、色調、畫風寫在這裡；某個人的髮色、身形要寫在那個人的證件照裡。</p>
      </div></div>`;
  }

  function renderPerson() {
    const isNew = !editing.id; const p = isNew ? { name: '', photo: '', look: '' } : person(people, ch, editing.id);
    editing.photo ??= p.photo;
    screen.innerHTML = `<div class="bp-al">${head(isNew ? '加配角' : esc(p.name), 'ids')}
      <div class="bp-al-scroll">
        <div class="bp-al-idpic" data-al="idpic">${editing.photo ? `<img src="${esc(editing.photo)}" alt="">` : '<span>點這裡放照片</span>'}</div>
        ${isNew ? '<label>名字（跟劇情、IG 裡出現的一樣）</label><input class="bp-al-idname" maxlength="20">' : ''}
        <label>長相與身形（生圖會照這段，英文 tag 最好，可以不寫）</label><textarea class="bp-al-idlook" rows="4" placeholder="髮色髮型、眼睛、身高身材、常穿的衣服。例如：ash-gray messy short hair, gray eyes, tall and slim, broad shoulders, black knit sweater">${esc(p.look)}</textarea>
        ${editing.id === HIM ? `<button class="bp-al-ghost" data-al="lookauto" ${busy ? 'disabled' : ''}>${busy ? '整理中⋯' : '從角色卡幫我整理'}</button>` : ''}
        ${!isNew && editing.id !== HIM && editing.id !== ME ? '<button class="bp-al-ghost danger" data-al="iddel">刪掉這個配角</button>' : ''}
      </div>
      <div class="bp-al-bar"><button data-al="idok">存好</button></div>
      <input class="bp-al-file" type="file" accept="image/*" hidden>
    </div>`;
  }

  async function shoot() {
    if (busy) return;
    const chat = recentChat(30);
    const scenes = chat.filter((m) => picked.has(m.i)).map((m) => `${m.who}：${m.text}`);
    const extra = screen.querySelector('.bp-al-extra')?.value.trim() || '';
    if (!scenes.length && !extra) { say('先挑一段劇情'); return; }
    busy = true; renderSnap();
    const who = ch;
    try {
      const r = parseJSON(await generate([
        '[Brume Phone · 快照]',
        `現在不是在寫劇情正文。請把下面這段劇情裡最值得留下來的一個畫面，想成一張照片（像是誰用手機拍下來的）。`,
        `${who.name} 的長相：${people.look.him || '照角色卡'}`,
        people.look.me ? `${who.user} 的長相：${people.look.me}` : '',
        ...sideNames(people).map((n) => person(people, who, n)).filter((c) => c.look).map((c) => `${c.name} 的長相（他有入鏡才寫）：${c.look}`),
        '', '劇情：', scenes.join('\n\n').slice(0, 3000), extra ? `\n她想拍的：${extra}` : '', '',
        '只輸出 JSON：{"desc":"照片拍到什麼，中文一句話","prompt":"生圖用的英文 prompt，逗號分隔：人物（照上面的長相）、動作、表情、場景、光線、鏡頭，寫實手機照片風格"}',
      ].filter(Boolean).join('\n')));
      const p = { id: uid(), source: 'snap', ts: Date.now(), desc: String(r.desc || '一張照片'), prompt: String(r.prompt || ''), scene: scenes.join('\n\n').slice(0, 1200) };
      p.img = p.prompt ? await imagine(snapPrompt(p), { refs: snapRefs(p) }) : '';
      note = p.img ? '' : '沒有出圖：酒館可能還沒接生圖。可以複製 prompt 拿去外面生，再按「傳生好的圖進來」。';
      if (who.key === ch?.key) { items.push(p); save(); }
      picked = new Set(); openId = p.id; view = 'one';
    } catch (e) { say(`拍照失敗：${e.message || e}`); }
    busy = false;
    if (mine()) render();
  }

  // 快照的參考照片：他和妳一定帶，劇情裡出現名字的配角也帶
  const snapText = (p) => `${p.scene || ''}\n${p.desc || ''}`;
  const snapRefs = (p) => refsFor(people, ch, snapText(p), [HIM, ME]);
  const snapPrompt = (p) => finalPrompt(people, ch, p.prompt, idsFor(people, snapText(p), [HIM, ME]));

  async function lookAuto() {
    busy = true; renderPerson();
    try {
      const t = await generate(`[Brume Phone · 長相]\n現在不是在寫劇情正文。請從角色卡整理出 ${ch.name} 的外貌，寫成生圖用的英文 tag：性別年齡感、髮型髮色、眼睛、臉部特徵、身材、常穿的衣服。只輸出一行，逗號分隔，不要其他文字。`);
      const box = screen.querySelector('.bp-al-idlook');
      if (box) box.value = t.trim().split('\n')[0].slice(0, 400);
    } catch (e) { say(`整理失敗：${e.message || e}`); }
    busy = false;
    const v = screen.querySelector('.bp-al-idlook')?.value;
    if (mine()) { renderPerson(); const b = screen.querySelector('.bp-al-idlook'); if (b && v != null) b.value = v; }
  }

  screen.addEventListener('click', async (e) => {
    if (!mine()) return;
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; render(); return; }
    const pr = e.target.closest('[data-person]'); if (pr) { editing = { id: pr.dataset.person }; view = 'person'; renderPerson(); return; }
    const ph = e.target.closest('[data-photo]'); if (ph) { openId = ph.dataset.photo; note = ''; view = 'one'; render(); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk) { const i = +pk.dataset.pick; if (picked.has(i)) picked.delete(i); else if (picked.size < 3) picked.add(i); else say('最多三段'); renderSnap(); return; }
    const a = e.target.closest('[data-al]')?.dataset.al;
    if (!a) return;
    const p = items.find((x) => x.id === openId);
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'grid') { view = 'grid'; render(); }
    if (a === 'snap') { view = 'snap'; renderSnap(); }
    if (a === 'ids') { view = 'grid'; tab = 'id'; editing = null; render(); }
    if (a === 'lookauto') lookAuto();
    if (a === 'idpic') { const f = screen.querySelector('.bp-al-file'); f.dataset.for = 'idpic'; f.click(); }
    if (a === 'idok' && editing) {
      const id = editing.id || screen.querySelector('.bp-al-idname')?.value.trim();
      if (!id) { say('先寫名字'); return; }
      if (!editing.id && (id === HIM || id === ME || people.cast[id])) { say('已經有這個名字了'); return; }
      setPerson(people, id, { photo: editing.photo, look: screen.querySelector('.bp-al-idlook')?.value.trim() || '' });
      if (!editing.id && !people.cast[id]) people.cast[id] = { photo: '', look: '' }; // 新配角什麼都沒放也留著，之後再補
      saveCast(ch.charKey, people); say('存好了'); view = 'grid'; tab = 'id'; editing = null; render();
    }
    if (a === 'iddel' && editing?.id) { setPerson(people, editing.id, {}); saveCast(ch.charKey, people); view = 'grid'; tab = 'id'; editing = null; render(); }
    if (a === 'shoot') shoot();
    if (a === 'upload') { const f = screen.querySelector('.bp-al-file'); f.dataset.for = 'new'; f.click(); }
    if (a === 'attach') { const f = screen.querySelector('.bp-al-file'); f.dataset.for = 'attach'; f.click(); }
    // 複製的是完整的 prompt（帶長相和照片風格），拿去外面生也一樣像
    if (a === 'copy' && p) { try { await navigator.clipboard.writeText(snapPrompt(p)); say('複製了'); } catch { say('這裡不能複製，長按文字自己選'); } }
    if ((a === 'gen' || a === 'regen') && p) {
      note = '生圖中⋯'; renderOne();
      const url = await imagine(snapPrompt(p), { refs: snapRefs(p) });
      if (url) { p.img = url; note = ''; save(); } else note = '沒有出圖：酒館可能還沒接生圖，或這次失敗了。';
      if (mine()) renderOne();
    }
    if (a === 'ig' && p?.img && !busy) {
      busy = 'ig'; renderOne();
      try {
        const cap = await onIG(p.img, p.desc !== '妳放的照片' ? p.desc : '', p.id);
        note = cap ? `他發了：「${cap}」` : '';
        say('他發到 IG 了');
      } catch (err) { note = `沒發成：${err.message || err}`; }
      busy = false; if (mine() && view === 'one') renderOne();
      return;
    }
    if (a === 'share' && p?.img) { onShare(p.img, p.source === 'upload' && p.desc !== '妳放的照片' ? p.desc : ''); return; }
    if (a === 'del' && p) { items = items.filter((x) => x.id !== p.id); save(); view = 'grid'; render(); }
  });

  screen.addEventListener('change', async (e) => {
    if (mine() && e.target.classList.contains('bp-al-style')) { people.look.style = e.target.value.trim(); saveCast(ch.charKey, people); say('照片風格存好了'); return; }
    if (mine() && e.target.classList.contains('bp-al-cap')) {
      const p = items.find((x) => x.id === openId);
      if (p) { p.desc = e.target.value.trim() || '妳放的照片'; save(); say('記下來了'); }
      return;
    }
    if (!mine() || !e.target.classList.contains('bp-al-file')) return;
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    // 一張約兩三百 KB；整本相本會同步到酒館伺服器，所以縮到 1280 寬
    // 證件照 768 寬：看得清臉，又不會讓同步的檔案太大
    if (e.target.dataset.for === 'idpic' && editing) { editing.photo = await store.shrink(files[0], 768, 0.85); const box = screen.querySelector('.bp-al-idpic'); if (box) box.innerHTML = `<img src="${editing.photo}" alt="">`; return; }
    if (e.target.dataset.for === 'attach') { const p = items.find((x) => x.id === openId); if (p) { p.img = await store.shrink(files[0], 1280, 0.82); note = ''; save(); renderOne(); } return; }
    const t0 = Date.now();
    for (const [i, f] of files.slice(0, 20).entries()) items.push({ id: uid(), source: 'upload', ts: t0 + i, desc: '妳放的照片', img: await store.shrink(f, 1280, 0.82) });
    save(); tab = 'mine'; render(); say(`放進相本了（${Math.min(files.length, 20)} 張）`);
  });

  // 伺服器比較慢才送到的相本（另一台放的照片），到了就重畫
  window.addEventListener('bp-store-late', async (e) => {
    if (!ch || e.detail !== 'album:' + ch.key) return;
    items = (await store.get('album:' + ch.key).catch(() => null)) || [];
    if (mine() && view === 'grid') render();
  });

  return {
    async open(to = 'grid') { await load(); view = to; picked = new Set(); note = ''; render(); },
  };
}
