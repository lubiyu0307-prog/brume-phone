// 一次生好幾張讓玩家挑：Gemini 不是每張都歪，是有時準有時歪，多給幾張挑最像的。
// 一張畫完再畫下一張：兩張同時叫 Pro，Google 常只放行一張，另一張退回 Flash 畫，「第二張通常很恐怖」（10/14）。
// 先出來的先顯示，玩家可以不等全部生完就挑；萬一還是退回別的模型，格子角落標出來。
// 沒選中的圖從酒館伺服器刪掉，不然每次都留三張用不到的

import { imagine, imageInfo, imageCountPref, imageModelPref, dropImage } from './st.js';

export async function imagineAndPick(screen, prompt, opts = {}) {
  const n = imageCountPref.get();
  if (n <= 1) return imagine(prompt, opts);
  const ar = { '4:3': '4 / 3', '9:16': '9 / 16' }[opts.aspect] || '1 / 1';
  const box = document.createElement('div');
  box.className = 'bp-pick';
  box.innerHTML = `<div class="bp-pick-in"><b>挑一張</b><small>生圖中⋯ 0/${n}</small>
    <div class="bp-pick-grid" style="--ar:${ar}">${'<i></i>'.repeat(n)}</div>
    <button data-pk="none">都不要</button></div>
    <div class="bp-pick-view" hidden><img alt=""><div class="bp-pick-nav"><button data-pk="prev">‹</button><span></span><button data-pk="next">›</button></div>
    <div class="bp-pick-acts"><button data-pk="back">回去看全部</button><button data-pk="use" class="ok">用這張</button></div></div>`;
  screen.appendChild(box);
  // 保險：畫面在生圖途中被重畫（innerHTML 換掉）時，把格子放回去，不然玩家看不到、永遠卡在生圖中
  const keep = setInterval(() => { if (chosen !== null) clearInterval(keep); else if (!box.isConnected) screen.appendChild(box); }, 400);
  const cells = [...box.querySelectorAll('.bp-pick-grid i')];
  const note = box.querySelector('small');
  const urls = []; let done = 0; let chosen = null; let finish;
  const result = new Promise((r) => { finish = r; });
  const settle = (url) => {
    if (chosen !== null) return;
    chosen = url; box.remove();
    for (const u of urls) if (u !== url) dropImage(u);
    finish(url);
  };
  // 格子太小看不出差別（10/14 露比說看不清楚）：點一下先放大，喜歡再按「用這張」，左右可以切換
  const view = box.querySelector('.bp-pick-view'); let at = 0;
  const show = (i) => {
    at = (i + urls.length) % urls.length;
    view.querySelector('img').src = urls[at];
    view.querySelector('span').textContent = `${at + 1} / ${urls.length}`;
    view.hidden = false;
  };
  box.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-i]');
    if (cell) { show(+cell.dataset.i); return; }
    const k = e.target.closest('[data-pk]')?.dataset.pk;
    if (k === 'none') { imageInfo.why = '這次都沒選'; settle(''); }
    if (k === 'back') view.hidden = true;
    if (k === 'prev') show(at - 1);
    if (k === 'next') show(at + 1);
    if (k === 'use') settle(urls[at]);
  });
  const one = async () => {
    const u = await imagine(prompt, opts);
    done++;
    if (u && chosen !== null) { dropImage(u); return; } // 已經挑好了，晚到的直接刪
    const off = u && imageInfo.model && !imageInfo.model.includes(imageModelPref.get()) ? (/pro/.test(imageInfo.model) ? 'Pro' : 'Flash') : '';
    if (u) { const i = urls.push(u) - 1; cells[i].innerHTML = `<img src="${u}" alt="">${off ? `<em>${off}</em>` : ''}`; cells[i].dataset.i = i; }
    note.textContent = done < n ? `生圖中⋯ ${done}/${n}${urls.length ? '（可以先挑）' : ''}` : urls.length ? '點一張用它' : `沒有出圖：${imageInfo.why || '這次失敗了'}`;
  };
  (async () => {
    for (let k = 0; k < n && chosen === null; k++) await one(); // 已經挑好就不再生剩下的，省錢
    if (!urls.length) setTimeout(() => settle(''), 2500); // 一張都沒有：讓玩家看一下原因再關
  })();
  return result;
}
