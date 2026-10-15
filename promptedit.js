// 長按生圖的照片（或還是文字的照片卡）→ 跳出這張照片的中文描述，可以改，改完存下來或直接用新的描述重新出圖。
// 相本、IG、他的手機共用。長相和照片風格不在這裡，出圖時會自動接上去。

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * root：要聽長按的容器
 * match(el)：按到的地方是哪張照片，回傳鍵，不是照片回 null
 * get(key)：回傳 { text } 或 null（這張沒有描述可以改）
 * run(key, text, redraw)：存下改過的描述；redraw 為 true 時用新描述重新出圖
 */
export function promptEditor(root, { match, get, run, say }) {
  let timer = 0; let start = null; let fired = false;
  const cancel = () => { clearTimeout(timer); timer = 0; };

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.bp-pe')) return;
    const key = match(e.target); if (key == null) return;
    fired = false; start = { x: e.clientX, y: e.clientY };
    cancel(); timer = setTimeout(() => { timer = 0; fired = true; open(key); }, 500);
  });
  root.addEventListener('pointermove', (e) => { if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); });
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('scroll', cancel, true);
  // 長按放開時瀏覽器還會送一個 click，吃掉，免得順便打開照片
  root.addEventListener('click', (e) => { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
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
      <div class="bp-pe-btns"><button data-pe="close">取消</button><button data-pe="save">存下來</button><button data-pe="redraw" class="ok">重新出圖</button></div></div>`;
    root.appendChild(box);
    const ta = box.querySelector('textarea');
    box.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-pe]')?.dataset.pe; if (!a) return;
      e.stopPropagation();
      if (a === 'close') { box.remove(); return; }
      const text = ta.value.trim();
      if (!text) { say?.('描述不能是空的'); return; }
      box.remove();
      await run(key, text, a === 'redraw');
    });
  }
}
