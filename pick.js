// 一次生好幾張讓玩家挑：Gemini 不是每張都歪，是有時準有時歪，多給幾張挑最像的。
// 一張畫完再畫下一張：兩張同時叫 Pro，Google 常只放行一張，另一張退回 Flash 畫，「第二張通常很恐怖」（10/14）。
// 先出來的先顯示，玩家可以不等全部生完就挑；萬一還是退回別的模型，格子角落標出來。
// 沒選中的圖從酒館伺服器刪掉，不然每次都留三張用不到的

import { imagine, imageInfo, imageCountPref, imageModelPref, imageEnginePref, shouldAskEngine, dropImage } from './st.js';

/**
 * 玩家按「生成」時問用哪家畫：兩家都有才問（只有一家直接回那家）。回傳 'gemini'｜'gpt'，取消回傳 null。
 * 按了哪家就記成預設，之後背景自動生的也用那家
 */
/** 只生一張：手機底下浮一顆「生圖中⋯」的小藥丸，不蓋畫面，玩家可以先去滑別的（10/21 比比：要能跑在背景）。
 *  生好了藥丸變成「照片好了」一下再收掉；叫它的那頁自己判斷還在不在畫面上再重畫 */
let pill = null; let pillN = 0;
export async function imagineWithWait(screen, prompt, opts = {}) {
  const host = screen.closest('.bp-phone') || screen;
  if (!pill) { pill = document.createElement('div'); pill.className = 'bp-genpill'; }
  pillN++;
  pill.innerHTML = `<div class="bp-app-wait"><i></i><i></i><i></i></div><b>生圖中⋯</b><small>${opts.engine === 'gpt' || imageEnginePref.get() === 'gpt' ? 'GPT 十到二十秒' : 'Gemini 十幾秒'}，可以先去滑別的</small>`;
  pill.classList.remove('bp-done'); host.appendChild(pill);
  let url = '';
  try { url = await imagine(prompt, opts); return url; }
  finally {
    pillN--;
    if (pillN <= 0) {
      pillN = 0;
      const p = pill; pill = null;
      p.classList.add('bp-done');
      p.innerHTML = url ? '<b>照片好了</b>' : `<b>沒有出圖</b><small>${imageInfo.why || '這次失敗了'}</small>`;
      setTimeout(() => p.remove(), url ? 1800 : 3200);
    }
  }
}

export function chooseEngine(screen) {
  if (!shouldAskEngine()) return Promise.resolve(imageEnginePref.get());
  return new Promise((resolve) => {
    const cur = imageEnginePref.get();
    const box = document.createElement('div');
    box.className = 'bp-pe bp-eng';
    box.innerHTML = `<div class="bp-pe-bg" data-eng="no"></div><div class="bp-pe-card">
      <b>用哪家畫</b>
      <div class="bp-pe-btns"><button data-eng="gemini" class="${cur === 'gemini' ? 'ok' : ''}">Gemini</button><button data-eng="gpt" class="${cur === 'gpt' ? 'ok' : ''}">GPT</button></div>
      <p>Gemini 親密的畫面比較肯畫；GPT 穿著衣服的日常、有文字的畫面比較穩，裸露的會擋。按了的那家會記成預設。</p></div>`;
    screen.appendChild(box);
    box.addEventListener('click', (e) => {
      const k = e.target.closest('[data-eng]')?.dataset.eng; if (!k) return;
      e.stopPropagation(); box.remove();
      if (k === 'no') { resolve(null); return; }
      imageEnginePref.set(k); resolve(k);
    });
  });
}

export async function imagineAndPick(screen, prompt, opts = {}) {
  const n = imageCountPref.get();
  if (n <= 1) return imagineWithWait(screen, prompt, opts);
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
    // 角落標：Gemini 退回另一個模型標 Pro／Flash；選的那家沒畫出來換另一家畫的，標那家的名字
    const off = u && imageInfo.switched ? (imageInfo.by === 'gpt' ? 'GPT' : 'Gemini') : u && /gemini/.test(imageInfo.model) && !imageInfo.model.includes(imageModelPref.get()) ? (/pro/.test(imageInfo.model) ? 'Pro' : 'Flash') : '';
    if (u) { const i = urls.push(u) - 1; cells[i].innerHTML = `<img src="${u}" alt="">${off ? `<em>${off}</em>` : ''}`; cells[i].dataset.i = i; }
    note.textContent = done < n ? `生圖中⋯ ${done}/${n}${urls.length ? '（可以先挑）' : ''}` : urls.length ? '點一張用它' : `沒有出圖：${imageInfo.why || '這次失敗了'}`;
  };
  (async () => {
    for (let k = 0; k < n && chosen === null; k++) await one(); // 已經挑好就不再生剩下的，省錢
    if (!urls.length) setTimeout(() => settle(''), 2500); // 一張都沒有：讓玩家看一下原因再關
  })();
  return result;
}
