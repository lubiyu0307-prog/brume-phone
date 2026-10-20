// 長按生圖的照片（或還是文字的照片卡）→ 跳出這張照片的中文描述，可以改，改完存下來或直接用新的描述重新出圖。
// 相本、IG、他的手機共用。長相和照片風格不在這裡，出圖時會自動接上去。

import { saveToPhone } from './st.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * root：要聽長按的容器
 * match(el)：按到的地方是哪張照片，回傳鍵，不是照片回 null
 * get(key)：回傳 { text, hasImg, img } 或 null（這張沒有描述可以改）；有 img 就多一顆「存到手機」
 * run(key, text, redraw)：存下改過的描述；redraw 為 true 時用新描述重新出圖
 * replace(key)：（可以不給）多一顆「換一張圖」，讓玩家拿自己在外面生好的圖補上來
 */
export function promptEditor(root, { match, get, run, say, replace }) {
  let timer = 0; let start = null; let fired = false;
  const cancel = () => { clearTimeout(timer); timer = 0; };

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bp-pe')) return;
    const key = match(e.target); if (key == null) return;
    fired = false; start = { x: e.clientX, y: e.clientY };
    cancel(); timer = setTimeout(() => { timer = 0; fired = true; open(key); }, 500);
  });
  root.addEventListener('pointermove', (e) => { if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); });
  // 長按放開時瀏覽器「可能」會送一個 click，吃掉免得順便打開照片——但 iPhone 常常不送，
  // 之前 fired 要等到下一次點擊才清掉，結果點到的是對話框的按鈕，第一下被吃掉，要按好幾次才有反應（10/19 比比）。
  // 改成放開後 350ms 內的 click 才吃，而且對話框裡面的點擊不吃
  const release = () => { cancel(); if (fired) setTimeout(() => { fired = false; }, 350); };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('scroll', cancel, true);
  root.addEventListener('click', (e) => { if (fired && !e.target.closest('.bp-pe')) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
  // 電腦上按右鍵也可以
  root.addEventListener('contextmenu', (e) => { const key = match(e.target); if (key == null) return; e.preventDefault(); cancel(); open(key); });

  function open(key) {
    const cur = get(key);
    if (!cur) { say?.('這張沒有描述可以改（是放進來的照片）'); return; }
    root.querySelector('.bp-pe')?.remove();
    const box = document.createElement('div');
    box.className = 'bp-pe';
    box.innerHTML = `<div class="bp-pe-bg" data-pe="close"></div><div class="bp-pe-card">
      <b>這張照片的描述</b>
      <textarea rows="7">${esc(cur.text)}</textarea>
      <p>改這段就能改照片內容。人物的長相和照片風格會自動接上，不用寫在這裡。</p>
      ${cur.img ? '<button class="bp-pe-save" data-pe="phone">存到手機</button>' : ''}
      ${replace ? `<button class="bp-pe-save" data-pe="replace">${cur.img ? '換一張圖（用自己生好的）' : '用自己生好的圖'}</button>` : ''}
      <div class="bp-pe-btns"><button data-pe="close">取消</button><button data-pe="save">存下來</button><button data-pe="redraw" class="ok">${cur.hasImg === false ? '生成照片' : '重新出圖'}</button></div></div>`;
    root.appendChild(box);
    const ta = box.querySelector('textarea');
    box.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-pe]')?.dataset.pe; if (!a) return;
      e.stopPropagation();
      if (a === 'close') { box.remove(); return; }
      if (a === 'phone') { await saveToPhone([cur.img], say); return; }
      if (a === 'replace') { box.remove(); await replace(key); return; }
      const text = ta.value.trim();
      if (!text) { say?.('描述不能是空的'); return; }
      box.remove();
      await run(key, text, a === 'redraw');
    });
  }
}
