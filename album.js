// 相本＋快照：挑一段正文，寫成照片；接了生圖就直接出圖，沒接就給 prompt 拿去外面生，生好再傳回來。
// 「證件照」分頁放他、妳、配角的參考照片和長相，每張快照都帶著，同一個人才不會每張長得不一樣。

import * as store from './store.js';
import { ctx, currentChar, generate, recentChat, imageInfo, imageModelPref, imageResPref, imageEnginePref, engines, shouldAskEngine, saveToPhone, openaiKey } from './st.js';
import { imagineAndPick, chooseEngine } from './pick.js';
import { P, promptLang } from './prompts.js';
import { promptEditor } from './promptedit.js';
import { HIM, ME, loadCast, saveCast, person, setPerson, sideNames, refsFor, idsFor, finalPrompt, ensureAutoStyle, splitLook } from './cast.js';

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
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
};

export function createAlbum({ screen, say, onShare, onIG }) {
  let ch = null; let items = []; let people = { cast: {}, look: { him: '', me: '' } }; let editing = null; // editing：證件照正在改的那個人
  let selecting = false; let sel = new Set(); // 「選取」模式（仿 iPhone 圖庫）：點格子打勾，下面刪除或存到手機
  // view：grid 圖庫｜one 單張｜snap 拍快照｜ids 生圖設定｜person 改某個人的證件照
  let view = 'grid'; let openId = null; let picked = new Set(); let busy = false; let note = ''; let shownImgs = [];
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
    const on = selecting && sel.has(p.id) ? ' sel' : '';
    const mark = selecting ? '<em></em>' : '';
    return p.img
      ? `<div class="bp-al-tile${on}" data-photo="${p.id}"><img src="${esc(p.img)}" alt="" loading="lazy">${mark}</div>`
      : `<div class="bp-al-tile card${on}" data-photo="${p.id}" style="--h:${hue(p.desc)}"><span>${esc(p.desc)}</span>${mark}</div>`;
  }

  // 右上角的齒輪：生圖設定（證件照、用哪家、模型、金鑰）。10/19 比比：分頁多餘，證件照那頁其實是設定，要跟照片分開
  const gear = () => `<i data-al="ids" title="生圖設定">${IC.gear}</i>`;

  function head(title, back = 'home', right = '') {
    return `<div class="bp-al-head"><span class="bp-back" data-al="${back}">‹</span><b>${title}</b><span>${right}</span></div>`;
  }

  async function render() {
    if (!ch && !(await load())) { screen.innerHTML = `<div class="bp-al">${head('圖庫')}<p class="bp-al-empty">先在酒館選一個角色。</p></div>`; return; }
    if (view === 'snap') return renderSnap();
    if (view === 'person') return renderPerson();
    if (view === 'ids') return renderIds();
    if (view === 'one') return renderOne();
    // 一格一格全部的照片：快照＋LINE 裡出現過的（以前放進來的照片也還在），不分頁
    const shown = [...items, ...(await chatPhotos())].sort((a, b) => b.ts - a.ts);
    shownImgs = shown.map((p) => p.img).filter(Boolean);
    for (const id of sel) if (!shown.some((p) => p.id === id)) sel.delete(id);
    const picked = shown.filter((p) => sel.has(p.id));
    // 表頭仿 iPhone 圖庫：大標題＋幾個項目，右邊齒輪跟「選取」
    screen.innerHTML = `<div class="bp-al">
      <div class="bp-al-top"><span class="bp-back" data-al="home">‹</span><div><b>圖庫</b><small>${selecting ? (sel.size ? `已選取 ${sel.size} 個項目` : '選取項目') : `${shown.length} 個項目`}</small></div>
        <span class="bp-al-topbtns">${selecting ? '' : gear()}${shown.length ? `<i data-al="select" class="${selecting ? 'on' : ''}">${selecting ? '取消' : '選取'}</i>` : ''}</span></div>
      <div class="bp-al-scroll">
        ${shown.length ? `<div class="bp-al-grid">${shown.map(tile).join('')}</div>` : '<p class="bp-al-empty">還沒有照片。<br>按右下角的相機，挑一段劇情拍下來。</p>'}
      </div>
      ${selecting
        ? `<div class="bp-al-selbar"><button data-al="selsave" ${picked.some((p) => p.img) ? '' : 'disabled'}>存到手機</button><button data-al="seldel" class="danger" ${picked.length ? '' : 'disabled'}>刪除</button></div>`
        : `<button class="bp-al-fab" data-al="snap">${IC.cam}</button>`}
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
        ${p.img ? '<button class="bp-al-saveall" data-al="phone">存到手機</button>' : ''}
        ${own ? `<div class="bp-al-acts">
          ${p.prompt && !p.img ? '<button data-al="gen">生成這張照片</button>' : ''}
          ${p.prompt ? '<button data-al="regen">重新生一張</button>' : ''}
          ${p.img && onShare ? '<button data-al="share">傳到 LINE 給他看</button>' : ''}
          ${p.img && onIG ? `<button data-al="ig" ${busy ? 'disabled' : ''}>${busy === 'ig' ? '他在想要寫什麼⋯' : '請他發到 IG'}</button>` : ''}
          <button data-al="del" class="danger">刪除</button></div>` : ''}
        <p class="bp-al-note">${esc(note)}</p>
      </div>
      <input class="bp-al-file" type="file" accept="image/*" hidden>
    </div>`;
  }

  function renderSnap() {
    const chat = recentChat(12).reverse();
    screen.innerHTML = `<div class="bp-al">${head('快照', 'grid', gear())}
      <div class="bp-al-scroll">
        <p class="bp-al-hint">挑一到三段劇情，拍成一張照片。${person(people, ch, HIM).photo || people.look.him ? '' : '<br><u data-al="ids">先到生圖設定放他的照片</u>，照片裡的他才會每張都一樣。'}</p>
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
    screen.innerHTML = `<div class="bp-al">${head('生圖設定', 'grid')}
      <div class="bp-al-scroll">
        <h4 class="bp-al-sec">人物</h4>
        <p class="bp-al-hint">放每個人的參考照片，快照和 IG 生圖時會拿給畫圖的模型看，同一個人才會每張都長一樣。配角的照片也是他在 IG 的大頭貼。</p>
        ${ctx()?.chatCompletionSettings?.chat_completion_source === 'openai' && !openaiKey.get() ? '<p class="bp-al-hint bp-al-warn">妳的正文用 OpenAI：生圖會用 GPT，但酒館那條只送得了文字、看不到這些照片。<u data-al="okeyjump">往下貼一次 OpenAI 金鑰</u>，GPT 才會照參考照片畫臉。</p>' : ''}
        <div class="bp-al-ids">${[HIM, ME, ...sideNames(people)].map(card).join('')}<div class="bp-al-id add" data-person=""><span class="bp-al-idnone">＋</span><b>加配角</b><small>名字要跟劇情裡一樣</small></div></div>
        <h4 class="bp-al-sec">生圖</h4>
        <label>照片風格（每張生圖都會套用，可以不寫）</label>
        <textarea class="bp-al-style" rows="3" placeholder="${people.look.autoStyle ? `沒寫的話照頭像判斷的：${esc(people.look.autoStyle)}` : '沒寫的話，第一次生圖會看角色卡頭像自己判斷寫實或動漫。也可以自己寫：日系動畫風、賽璐璐上色／底片感、暖色調'}">${esc(people.look.style)}</textarea>
        <p class="bp-al-hint">畫風、濾鏡、色調寫在這裡，寫了就以這裡為準（例如寫動漫風，就不會畫成寫實照片）。某個人的髮色、身形要寫在那個人的證件照裡。</p>
        <label>照片質感（寫實照片才套用）</label>
        <div class="bp-al-seg">${[['polished', '精修・像 GPT'], ['candid', '生活感・手機隨手拍']].map(([v, n]) => `<b data-al="preset" data-v="${v}" class="${(people.look.preset || 'polished') === v ? 'on' : ''}">${n}</b>`).join('')}</div>
        <p class="bp-al-hint">精修：皮膚光滑、淺景深、電影劇照感。生活感：保留毛孔和手機雜訊，像朋友隨手拍、發在 SNS 上的照片。</p>
        <label>生圖指令的語言</label>
        <div class="bp-al-seg">${[['zh', '中文'], ['en', 'English']].map(([v, n]) => `<b data-al="lang" data-v="${v}" class="${promptLang.get() === v ? 'on' : ''}">${n}</b>`).join('')}</div>
        <p class="bp-al-hint">送去生圖的指令、新快照的 prompt、複製出來的內容都會用這個語言。後台指令都寫在小手機資料夾的 prompts.js，想自己調可以改那裡。</p>
        <h4 class="bp-al-sec">金鑰</h4>
        <label>生圖用哪家</label>
        <div class="bp-al-seg">${[['gemini', 'Gemini'], ['gpt', 'GPT']].map(([v, n]) => `<b data-al="imgengine" data-v="${v}" class="${imageEnginePref.get() === v ? 'on' : ''}${(v === 'gemini' ? engines().gemini : engines().gpt) ? '' : ' off'}">${n}${(v === 'gemini' ? engines().gemini : engines().gpt) ? '' : '・沒金鑰'}</b>`).join('')}</div>
        <p class="bp-al-hint">背景自動生的照片用這家。自己按「生成」時，兩家都有金鑰才會問妳用哪家，只有一家就直接用；選的那家沒畫出來會換另一家畫，照片角落會標。Gemini 親密的畫面比較肯畫，GPT 穿著衣服的日常、有文字的畫面比較穩。</p>
        <label>Gemini 的模型</label>
        <div class="bp-al-seg">${[['flash', 'Flash・快'], ['pro', 'Pro・細']].map(([v, n]) => `<b data-al="imgmodel" data-v="${v}" class="${imageModelPref.get() === v ? 'on' : ''}">${n}</b>`).join('')}</div>
        <p class="bp-al-hint">Flash 一張十幾秒；Pro 二十秒上下，光影和細節比較細，費用也比較高。選的那個叫不到時，會自動換另一個。GPT 只有一個模型（gpt-image-2），這格不影響它。</p>
        <label>解析度</label>
        <div class="bp-al-seg">${[['1K', '1K・省錢'], ['2K', '2K・清楚']].map(([v, n]) => `<b data-al="imgres" data-v="${v}" class="${imageResPref.get() === v ? 'on' : ''}">${n}</b>`).join('')}</div>
        <p class="bp-al-hint">Gemini：1K 比較便宜，近景、自拍、限動在手機上看差不多；2K 全身照、遠景的臉比較不會糊。GPT：1K＝低畫質（帶證件照一張約 0.02 美金，不到一塊台幣），2K＝高畫質（約 0.25 美金，八塊左右）；臉像不像靠的是證件照不是畫質，低畫質的臉常常反而比較自然。</p>
        <label>AI Studio 金鑰（酒館那邊叫不到 Gemini 生圖時，手機直接用這把；跟電話的聲音共用）</label>
        <input class="bp-al-gkey" type="password" autocomplete="off" placeholder="${(() => { try { return localStorage.getItem('brume-phone:gemini-key') ? '已經貼好了（重貼會換掉）' : '貼上 AI Studio 金鑰'; } catch { return '貼上 AI Studio 金鑰'; } })()}">
        <label>OpenAI 金鑰（用 GPT 生圖，可以不貼）</label>
        <input class="bp-al-okey" type="password" autocomplete="off" placeholder="${openaiKey.get() ? '已經貼好了（重貼會換掉，清空存檔就拿掉）' : '貼上 OpenAI 金鑰（sk- 開頭）'}">
        <p class="bp-al-hint">怎麼拿：到 platform.openai.com 登入（跟 ChatGPT 訂閱是兩回事，要另外付錢）→ Billing 儲值，最低 5 美金，把 Auto-reload 關掉、Limits 填每月上限，用完就停不會多扣 → API keys 建一把，權限選 Restricted、只把 Images 開成 Request，別的留 None。這樣就算金鑰外流，別人也只能拿它生圖、只能燒到妳設的上限，隨時回去按 Revoke 就作廢。<br>費用：低畫質一張約 0.02 美金、高畫質約 0.25；被擋的那張也會扣一點點（讀證件照的錢）。<br>它不給畫的：裸露、床上的畫面，審查已經調到最低還是會擋，這種交給 Gemini。<br>正文用 OpenAI 玩的，沒貼也會借酒館的 OpenAI 金鑰生圖，但那條只送得了文字、看不到證件照，臉會每張不一樣；貼了這把才會帶證件照一起生。金鑰只存在這台。</p>
      </div></div>`;
  }

  function renderPerson() {
    const isNew = !editing.id; const p = isNew ? { name: '', photo: '', look: '' } : person(people, ch, editing.id);
    editing.photo ??= p.photo;
    screen.innerHTML = `<div class="bp-al">${head(isNew ? '加配角' : esc(p.name), 'ids')}
      <div class="bp-al-scroll">
        <div class="bp-al-idpic" data-al="idpic">${editing.photo ? `<img src="${esc(editing.photo)}" alt="">` : '<span>點這裡放照片</span>'}</div>
        ${isNew ? '<label>名字（跟劇情、IG 裡出現的一樣）</label><input class="bp-al-idname" maxlength="20">' : ''}
        <label>長相與身形（生圖會照這段，中文英文都可以，可以不寫）</label><textarea class="bp-al-idlook" rows="4" placeholder="性別年紀、髮色髮型、眼睛、身高身材、常穿的衣服。例如：二十多歲的男生，灰棕色亂髮，灰色眼睛，高、寬肩、結實，常穿黑色針織衫">${esc(p.look)}</textarea>
        <label>特色（照片看不清楚、或想加強的地方）</label><input class="bp-al-idhair" maxlength="80" value="${esc(p.hair || '')}" placeholder="例如：深灰色頭髮、臉頰雀斑、左手臂花草刺青">
        ${editing.id === HIM ? `<button class="bp-al-ghost" data-al="lookauto" ${busy ? 'disabled' : ''}>${busy ? '整理中⋯' : '從角色卡幫我整理'}</button>` : ''}
        ${!isNew && editing.id !== HIM && editing.id !== ME ? '<button class="bp-al-ghost danger" data-al="iddel">刪掉這個配角</button>' : ''}
      </div>
      <div class="bp-al-bar"><button data-al="idok">存好</button></div>
      <input class="bp-al-file" type="file" accept="image/*" hidden>
    </div>`;
  }


  // 把欄位組成固定格式的生圖描述（鏡頭 → 地點 → 每個人 → 物品 → 光線），每張快照的 prompt 長得一樣整齊
  function snapFromFields(r) {
    const ppl = (Array.isArray(r.people) ? r.people : []).map((x) => [x.name, x.doing, x.face, x.wearing && P.WEARING(x.wearing)].filter(Boolean).join(P.COMMA)).filter(Boolean);
    return [[r.shot, r.angle].filter(Boolean).join(P.COMMA), r.place, ...ppl, r.props, r.light].filter(Boolean).map((t) => String(t).trim()).join(P.PERIOD);
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
      // 不讓寫劇情的模型自由寫 prompt：它會把長相、內心戲、氣味都塞進去，鏡頭和誰在哪也常漏掉，圖就跟著怪（10/14 露比發現的）。
      // 改成照欄位填，程式再組成固定格式的生圖描述
      const r = parseJSON(await generate([
        '[Brume Phone · 快照]',
        `現在不是在寫劇情正文。請把下面這段劇情裡最值得留下來的一個瞬間，想成一張用手機拍下來的照片，照欄位填寫。`,
        `${who.name} 的衣櫃：${splitLook(people.look.him || '').wardrobe || '照角色卡'}`,
        people.look.me ? `${who.user} 的衣櫃：${splitLook(people.look.me).wardrobe || '照劇情'}` : '',
        '', '劇情：', scenes.join('\n\n').slice(0, 3000), extra ? `\n她想拍的：${extra}` : '', '',
        '填寫規則：',
        '- 只寫鏡頭拍得到的東西：動作、姿勢、表情、穿著、物品、地點、光線。不寫心情、內心話、氣味、聲音、比喻',
        '- 不寫長相：臉、髮色、髮型、眼睛、年紀、身材都不要寫（證件照會處理）',
        '- 只拍一個瞬間：每個人一個動作、一個表情，寫具體（「左手撐著下巴看她」，不是「很溫柔」）',
        '- 穿著照劇情這一刻；劇情沒寫才從衣櫃挑一套搭得起來的',
        // 不問「誰拍的」改問「鏡頭從哪裡看」：問誰拍的，在家窩沙發這種沒有別人的場景模型只能選自拍（10/14 露比的點子）
        `- angle 寫鏡頭從哪裡看：位置、高度、距離，例如「從沙發對面稍低的角度」「從他肩膀後面看過去」「隔著扭蛋機的透明罩」；可以有一點前景擋在鏡頭前，更有景深`,
        `- ${who.user} 沒入鏡的話，鏡頭就是 ${who.user} 的視線（第一人稱）`,
        '- 除非劇情真的寫到自拍或拍照，畫面裡不要有人拿著手機在拍',
        `- in 列出畫面裡看得到臉的人（${who.name}、${who.user} 或配角的名字）`,
        '- 鏡頭選這一刻最自然的：近景、半身、七分身、全身、背影；人多半沒注意到鏡頭',
        '- 地點寫具體，背景放兩三樣看得到的東西',
        P.SNAP_LANG,
        '只輸出 JSON：{"desc":"照片拍到什麼，中文一句話","in":["入鏡的人名"],"shot":"鏡頭","angle":"鏡頭從哪裡看","people":[{"name":"人名","doing":"動作和姿勢","face":"表情和視線","wearing":"穿著"}],"place":"地點和背景","props":"重要的物品","light":"時間和光線"}',
      ].filter(Boolean).join('\n')));
      r.prompt = r.prompt || snapFromFields(r);
      // 生圖前先給玩家看一眼：模型把劇情翻成畫面時猜錯（誰拍的、鏡頭多遠、誰在畫面裡），在花額度之前改掉
      const ok = await confirmSnap(r, who);
      if (!ok) { busy = false; if (mine()) renderSnap(); return; }
      const p = { id: uid(), source: 'snap', ts: Date.now(), desc: String(r.desc || '一張照片'), in: ok.in, by: ok.by, prompt: ok.prompt, scene: scenes.join('\n\n').slice(0, 1200) };
      if (p.prompt) await ensureAutoStyle(people, who.charKey);
      // 快照用橫的 4:3，像真的相機拍的（跟 GPT 對照時比正方形自然）
      p.img = p.prompt ? await imagineAndPick(screen, snapPrompt(p), { refs: snapRefs(p), aspect: '4:3', engine: ok.engine }) : '';
      note = drawnNote(p.img) || (p.img ? imageInfo.switched : '沒有出圖：正文要接 Google 或 OpenAI，或到右上角生圖設定貼 AI Studio／OpenAI 金鑰。也可以複製 prompt 拿去外面生，長按這張選「換一張圖」補上來。');
      if (who.key === ch?.key) { items.push(p); save(); }
      picked = new Set(); openId = p.id; view = 'one';
    } catch (e) { say(`拍照失敗：${e.message || e}`); }
    busy = false;
    if (mine()) render();
  }

  // 沒畫出來就講 Gemini 卡在哪
  const drawnNote = (url) => (!url && imageInfo.why ? `沒有出圖：${imageInfo.why}` : '');
  // 只帶真的入鏡的人：畫面只有他卻連妳的照片一起送，他的頭髮會被染成妳的髮色（10/14 企鵝館那張）。
  // 舊的快照沒有 in，照描述裡有沒有提到名字判斷；都沒提到就當他入鏡
  function snapWho(p) {
    if (Array.isArray(p.in)) return p.in.map((n) => (n === ch.name ? HIM : n === ch.user ? ME : n)).filter((id) => id === HIM || id === ME || people.cast[id]);
    const ids = [p.desc.includes(ch.user) || /她|妳|你/.test(p.desc) ? ME : null, p.desc.includes(ch.name) || /他/.test(p.desc) ? HIM : null].filter(Boolean);
    return ids.length ? ids : [HIM];
  }
  const snapRefs = (p) => refsFor(people, ch, p.desc || '', snapWho(p));
  // 快照是妳用手機拍的：畫面裡沒有妳，就講明是妳拍的第一人稱照片，不然「他把硬幣遞過來」這種畫面，
  // Gemini 會自己生一個收硬幣的人出來，有時是他的分身，有時硬塞一個妳（10/14）
  // p.by 是確認畫面選的「誰拍的」：me 妳拍、him 他拍、other 路人拍（沒有第一人稱）；舊快照沒有，照有沒有妳判斷
  const snapPrompt = (p) => {
    const ids = idsFor(people, p.desc || '', snapWho(p));
    const by = p.by === 'him' ? HIM : p.by === 'me' ? ME : p.by === 'other' ? null : (ids.includes(ME) ? null : ME);
    return finalPrompt(people, ch, p.prompt, ids, { by });
  };

  // 快照確認畫面：描述可以改，鏡頭、入鏡的人、誰拍的用點的。回傳 { prompt, in, by }，取消回傳 null
  function confirmSnap(r, who) {
    return new Promise((resolve) => {
      const names = [who.name, who.user, ...sideNames(people)].filter((n, i, a) => n && a.indexOf(n) === i);
      const inSet = new Set((Array.isArray(r.in) ? r.in.map(String) : [who.name]).filter((n) => names.includes(n)));
      let shot = ''; let by = inSet.has(who.user) ? 'other' : 'me';
      let composed = String(r.prompt || '');
      const box = document.createElement('div');
      box.className = 'bp-pe bp-cf';
      const chip = (k, v, label, on) => `<button class="bp-cf-chip${on ? ' on' : ''}" data-cf="${k}" data-v="${esc(v)}">${esc(label)}</button>`;
      const draw = () => {
        box.querySelectorAll('[data-cf="shot"]').forEach((b) => b.classList.toggle('on', b.dataset.v === shot));
        box.querySelectorAll('[data-cf="in"]').forEach((b) => b.classList.toggle('on', inSet.has(b.dataset.v)));
        box.querySelectorAll('[data-cf="by"]').forEach((b) => b.classList.toggle('on', b.dataset.v === by));
      };
      box.innerHTML = `<div class="bp-pe-bg" data-cf="no"></div><div class="bp-pe-card">
        <b>確認畫面</b>
        ${r.desc ? `<p class="bp-cf-desc">${esc(r.desc)}</p>` : ''}
        <textarea rows="6">${esc(composed)}</textarea>
        <div class="bp-cf-row"><span>鏡頭</span>${chip('shot', '', '照描述', true)}${P.SHOTS.map((x) => chip('shot', x, x, false)).join('')}</div>
        <div class="bp-cf-row"><span>入鏡</span>${names.map((n) => chip('in', n, n, inSet.has(n))).join('')}</div>
        <div class="bp-cf-row"><span>誰拍的</span>${chip('by', 'me', `${who.user}拍`, by === 'me')}${chip('by', 'him', `${who.name}拍`, by === 'him')}${chip('by', 'other', '別人拍', by === 'other')}</div>
        <p>不對就改上面那段或點選項，人物長相和照片風格會自動接上。${shouldAskEngine() ? 'Gemini 親密的畫面比較肯畫；GPT 穿著衣服的日常比較穩、裸露的會擋。' : ''}</p>
        <div class="bp-pe-btns"><button data-cf="no">取消</button>${shouldAskEngine()
          ? `<button data-cf="ok" data-v="gemini" class="${imageEnginePref.get() === 'gemini' ? 'ok' : ''}">用 Gemini 拍</button><button data-cf="ok" data-v="gpt" class="${imageEnginePref.get() === 'gpt' ? 'ok' : ''}">用 GPT 拍</button>`
          : '<button data-cf="ok" class="ok">生成照片</button>'}</div></div>`;
      screen.appendChild(box);
      const ta = box.querySelector('textarea');
      const done = (v) => { box.remove(); resolve(v); };
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cf]'); if (!b) return;
        e.stopPropagation();
        const k = b.dataset.cf; const v = b.dataset.v;
        if (k === 'no') { done(null); return; }
        if (k === 'shot') {
          shot = v;
          // 還沒手改過描述：直接換掉描述開頭的鏡頭；改過了就等送出時加在最前面
          if (ta.value === composed) { r.shot = shot || r.shotOrig || r.shot; composed = snapFromFields(r); ta.value = composed; }
        }
        if (k === 'in') { if (inSet.has(v)) inSet.delete(v); else inSet.add(v); }
        if (k === 'by') by = v;
        if (k === 'ok') {
          let text = ta.value.trim();
          if (!text) { say('描述不能是空的'); return; }
          if (shot && !text.includes(shot)) text = `${shot}${P.PERIOD}${text}`;
          const engine = v === 'gpt' || v === 'gemini' ? v : imageEnginePref.get();
          if (v === 'gpt' || v === 'gemini') imageEnginePref.set(v); // 按了哪家就記成預設
          done({ prompt: text, in: names.filter((n) => inSet.has(n)), by, engine });
          return;
        }
        draw();
      });
      r.shotOrig = r.shot;
    });
  }

  async function lookAuto() {
    busy = true; renderPerson();
    try {
      const t = await generate(`[Brume Phone · 長相]\n現在不是在寫劇情正文。請從角色卡整理出 ${ch.name} 的外貌，寫成生圖用的中文描述：性別年齡感、髮型髮色、眼睛、臉部特徵、身材、常穿的衣服。只輸出一行，用逗號分隔，不要其他文字。`);
      const box = screen.querySelector('.bp-al-idlook');
      if (box) box.value = t.trim().split('\n')[0].slice(0, 400);
    } catch (e) { say(`整理失敗：${e.message || e}`); }
    busy = false;
    const v = screen.querySelector('.bp-al-idlook')?.value;
    if (mine()) { renderPerson(); const b = screen.querySelector('.bp-al-idlook'); if (b && v != null) b.value = v; }
  }

  screen.addEventListener('click', async (e) => {
    if (!mine()) return;
    const pr = e.target.closest('[data-person]'); if (pr) { editing = { id: pr.dataset.person }; view = 'person'; renderPerson(); return; }
    const ph = e.target.closest('[data-photo]');
    if (ph && selecting) { const id = ph.dataset.photo; if (sel.has(id)) sel.delete(id); else sel.add(id); render(); return; }
    if (ph) { openId = ph.dataset.photo; note = ''; view = 'one'; render(); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk) { const i = +pk.dataset.pick; if (picked.has(i)) picked.delete(i); else if (picked.size < 3) picked.add(i); else say('最多三段'); renderSnap(); return; }
    const a = e.target.closest('[data-al]')?.dataset.al;
    if (!a) return;
    const p = items.find((x) => x.id === openId);
    if (a === 'home') { selecting = false; sel = new Set(); screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true })); }
    if (a === 'select') { selecting = !selecting; sel = new Set(); render(); return; }
    if (a === 'selsave') { const all = [...items, ...(await chatPhotos())]; await saveToPhone(all.filter((p) => sel.has(p.id) && p.img).map((p) => p.img), say); return; }
    if (a === 'seldel') {
      if (!sel.size) return;
      if (!window.confirm(`刪除 ${sel.size} 張照片？`)) return;
      // LINE 裡的照片：那則訊息的圖拿掉（只有圖沒有字的，整則拿掉），LINE 那邊會跟著重讀（10/19 比比：為什麼不能刪）
      const lineIds = [...sel].filter((id) => String(id).startsWith('line-')).map((id) => id.slice(5));
      if (lineIds.length) {
        const t = await store.get('line:' + ch.key).catch(() => null);
        if (t?.msgs) {
          t.msgs = t.msgs.map((m) => { if (!lineIds.includes(m.id)) return m; if (!m.text) return null; const c = { ...m }; delete c.img; return c; }).filter(Boolean);
          await store.set('line:' + ch.key, t).catch(() => {});
          window.dispatchEvent(new CustomEvent('bp-line-reload', { detail: ch.key }));
        }
      }
      const n = sel.size;
      items = items.filter((p) => !sel.has(p.id)); save(); selecting = false; sel = new Set(); render(); say(`刪了 ${n} 張`); return;
    }
    if (a === 'grid') { view = 'grid'; render(); }
    if (a === 'snap') { selecting = false; sel = new Set(); view = 'snap'; renderSnap(); }
    if (a === 'ids') { view = 'ids'; editing = null; render(); }
    if (a === 'lookauto') lookAuto();
    if (a === 'preset') { people.look.preset = e.target.closest('[data-v]').dataset.v; saveCast(ch.charKey, people); say(people.look.preset === 'candid' ? '之後拍成生活感' : '之後拍成精修'); renderIds(); return; }
    if (a === 'lang') { promptLang.set(e.target.closest('[data-v]').dataset.v); say(promptLang.get() === 'en' ? '生圖指令改用英文' : '生圖指令改用中文'); renderIds(); return; }
    if (a === 'okeyjump') { const k = screen.querySelector('.bp-al-okey'); k?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => k?.focus(), 400); return; }
    if (a === 'imgres') { imageResPref.set(e.target.closest('[data-v]').dataset.v); say(`之後用 ${imageResPref.get()} 生圖`); renderIds(); return; }
    if (a === 'imgengine') {
      const v = e.target.closest('[data-v]').dataset.v; const h = engines();
      if (v === 'gpt' && !h.gpt) { say('還沒貼 OpenAI 金鑰，往下貼一把'); const k = screen.querySelector('.bp-al-okey'); k?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (v === 'gemini' && !h.gemini) { say('正文沒接 Google，也還沒貼 AI Studio 金鑰'); return; }
      imageEnginePref.set(v); say(v === 'gpt' ? '之後用 GPT 生圖' : '之後用 Gemini 生圖'); renderIds(); return;
    }
    if (a === 'imgmodel') { imageModelPref.set(e.target.closest('[data-v]').dataset.v); say(imageModelPref.get() === 'pro' ? '之後用 Pro 生圖' : '之後用 Flash 生圖'); renderIds(); return; }
    if (a === 'idpic') { const f = screen.querySelector('.bp-al-file'); f.dataset.for = 'idpic'; f.click(); }
    if (a === 'idok' && editing) {
      const id = editing.id || screen.querySelector('.bp-al-idname')?.value.trim();
      if (!id) { say('先寫名字'); return; }
      if (!editing.id && (id === HIM || id === ME || people.cast[id])) { say('已經有這個名字了'); return; }
      setPerson(people, id, { photo: editing.photo, look: screen.querySelector('.bp-al-idlook')?.value.trim() || '', hair: screen.querySelector('.bp-al-idhair')?.value.trim() || '' });
      if (!editing.id && !people.cast[id]) people.cast[id] = { photo: '', look: '' }; // 新配角什麼都沒放也留著，之後再補
      saveCast(ch.charKey, people); say('存好了'); view = 'ids'; editing = null; render();
    }
    if (a === 'iddel' && editing?.id) { setPerson(people, editing.id, {}); saveCast(ch.charKey, people); view = 'ids'; editing = null; render(); }
    if (a === 'shoot') shoot();
    if (a === 'attach') { const f = screen.querySelector('.bp-al-file'); if (f) { f.dataset.for = 'attach'; f.click(); } }
    // 複製的是完整的 prompt（帶長相和照片風格），拿去外面生也一樣像
    if (a === 'saveall') { await saveToPhone(shownImgs, say); return; }
    if (a === 'phone') { await saveToPhone([screen.querySelector('.bp-al-big')?.getAttribute('src')], say); return; } // 聊天裡的照片不在 items，直接拿畫面上那張
    if (a === 'copy' && p) { try { await navigator.clipboard.writeText(snapPrompt(p)); say('複製了'); } catch { say('這裡不能複製，長按文字自己選'); } }
    if ((a === 'gen' || a === 'regen') && p) await redraw(p);
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
    if (a === 'share' && p?.img) { onShare(p.img, p.source === 'upload' && p.desc !== '妳放的照片' ? p.desc : ''); return; } // 以前放進來的照片還在的話照舊
    if (a === 'del' && p) { items = items.filter((x) => x.id !== p.id); save(); view = 'grid'; render(); }
  });

  screen.addEventListener('change', async (e) => {
    if (mine() && e.target.classList.contains('bp-al-gkey')) {
      const v = e.target.value.trim(); if (!v) return;
      try { localStorage.setItem('brume-phone:gemini-key', v); } catch { /* 存不了 */ }
      e.target.value = ''; e.target.placeholder = '已經貼好了（重貼會換掉）'; say('金鑰存好了，只存在這台'); return;
    }
    if (mine() && e.target.classList.contains('bp-al-okey')) {
      const v = e.target.value.trim(); openaiKey.set(v);
      e.target.value = ''; e.target.placeholder = v ? '已經貼好了（重貼會換掉，清空存檔就拿掉）' : '貼上 OpenAI 金鑰（sk- 開頭）'; say(v ? 'OpenAI 金鑰存好了，只存在這台' : 'OpenAI 金鑰拿掉了'); return;
    }
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
    // 換一張圖（長按選單）：拿外面生好的圖補到這張快照上。「放照片」整批放進相本的功能 10/19 拿掉了（LINE 裡直接傳就好）
    if (e.target.dataset.for === 'attach') { const p = items.find((x) => x.id === openId); if (p) { p.img = await store.shrink(files[0], 1280, 0.82); note = ''; save(); renderOne(); } }
  });

  // 伺服器比較慢才送到的相本（另一台放的照片），到了就重畫
  window.addEventListener('bp-store-late', async (e) => {
    if (!ch || e.detail !== 'album:' + ch.key) return;
    items = (await store.get('album:' + ch.key).catch(() => null)) || [];
    if (mine() && view === 'grid') render();
  });

  async function redraw(p) {
    openId = p.id; view = 'one';
    // 先等畫面重畫完再叫挑圖：renderOne 是非同步的，晚一步寫 innerHTML 會把挑圖的格子蓋掉（10/14 卡在「生圖中⋯」）
    note = '生圖中⋯'; await renderOne();
    const engine = await chooseEngine(screen); if (!engine) { note = ''; if (mine()) renderOne(); return; } // 兩家都有才會問；取消就不重生
    await ensureAutoStyle(people, ch.charKey);
    const url = await imagineAndPick(screen, snapPrompt(p), { refs: snapRefs(p), aspect: '4:3', engine });
    if (url) { p.img = url; save(); }
    note = drawnNote(url) || (url ? imageInfo.switched : '沒有出圖：正文要接 Google 或 OpenAI，或到右上角生圖設定貼 AI Studio／OpenAI 金鑰。');
    if (mine()) renderOne();
  }

  // 長按快照（格子或大圖）→ 改描述、重新出圖。妳放的照片沒有描述，不能改
  promptEditor(screen, {
    say,
    match: (el) => { if (!mine()) return null; const t = el.closest('.bp-al-tile[data-photo]'); if (t) return t.dataset.photo; return el.closest('.bp-al-big, .bp-al-bigcard') && view === 'one' ? openId : null; },
    get: (id) => { const p = items.find((x) => x.id === id); return p?.prompt ? { text: p.prompt, hasImg: !!p.img, img: p.img } : null; },
    run: async (id, text, again) => {
      const p = items.find((x) => x.id === id); if (!p) return;
      p.prompt = text; save();
      if (again) await redraw(p); else { say('描述存好了'); if (view === 'one') renderOne(); }
    },
    // 換一張圖：自己在外面生好的圖補上來（以前是單張畫面上的「傳生好的圖進來」，10/19 比比說平常用不到，收進這裡）
    replace: async (id) => {
      const p = items.find((x) => x.id === id); if (!p) return;
      openId = p.id; if (view !== 'one') { view = 'one'; await renderOne(); }
      const f = screen.querySelector('.bp-al-file'); if (f) { f.dataset.for = 'attach'; f.click(); }
    },
  });

  return {
    async open(to = 'grid') { await load(); view = to; picked = new Set(); selecting = false; sel = new Set(); note = ''; render(); },
  };
}
