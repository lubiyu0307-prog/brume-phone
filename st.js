// 跟酒館打交道的共用小工具

import { P } from './prompts.js';

export const ctx = () => window.SillyTavern?.getContext?.();

/** 現在開著的角色；沒選角色或在群組聊天時回 null */
export function currentChar() {
  const c = ctx();
  if (!c || c.groupId || c.characterId === undefined || c.characterId === null) return null;
  const ch = c.characters?.[c.characterId];
  if (!ch) return null;
  const charKey = ch.avatar || ch.name;
  // 手機的資料照「聊天」分：同一個角色開新的聊天（不同開場）就是另一個故事，另一支手機
  const chatId = c.getCurrentChatId?.() || '';
  return {
    key: chatId ? `${charKey}::${chatId}` : charKey,
    charKey,
    name: ch.name,
    avatar: ch.avatar ? `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}` : '',
    user: c.name1 || '我',
  };
}

// 省 token 模式（預設開）：不送整份預設＋整段正文，只送角色卡、被叫醒的世界書、正文最後幾則
const LITE_KEY = 'brume-phone:lite';
export const lite = {
  get() { try { return localStorage.getItem(LITE_KEY) !== '0'; } catch { return true; } },
  set(on) { try { localStorage.setItem(LITE_KEY, on ? '1' : '0'); } catch { /* 無痕模式存不了 */ } },
};

// 省 token 模式不帶預設，少了預設開頭那段創作脈絡，Vertex 會把「人設寫嬌小＋世界書的親密條目＋床上的劇情」
// 誤判成未成年而整包擋掉（PROHIBITED_CONTENT）。這段補回成年人創作的前提，R18 照樣完整帶進去。
const PHONE_MODE = '【手機模式】現在寫的是小手機裡的東西，不是劇情正文。上面設定裡關於正文的寫法、字數、排版、狀態欄、變數更新、輸出格式的規則全部不適用：不要寫狀態欄、不要寫任何 <標籤> 區塊、不要寫旁白，只照要求輸出。';
const ADULT_FRAME = '這是成年人之間的虛構互動創作，供成年玩家私下閱讀。故事裡所有角色都是成年人，年齡以角色卡與玩家人設寫的為準；身材描述（嬌小、纖細等）只是外貌，不代表年齡。內容可以包含成年人之間合意的親密情節。';

async function liteContext(c, prompt) {
  const ch = c.characters?.[c.characterId] || {};
  const sub = (t) => (c.substituteParams ? c.substituteParams(String(t || '')) : String(t || ''));
  let f = {};
  try { f = c.getCharacterCardFields?.() || {}; } catch { /* 舊版酒館沒有這個 */ }
  const description = f.description ?? sub(ch.description);
  const personality = f.personality ?? sub(ch.personality);
  const scenario = f.scenario ?? sub(ch.scenario);
  const persona = f.persona || '';
  const lines = (c.chat || []).filter((m) => !m.is_system && m.mes)
    .map((m) => `${m.is_user ? c.name1 : m.name}：${String(m.mes).replace(/<[^>]+>/g, '').slice(0, 400)}`);
  const recent = lines.slice(-6);
  // 世界書用比較多則來掃：配角最近幾則沒出場，他的條目還是要叫得到，不然模型會自己幫他編職業（10/15 老吳變成獸醫）
  const scan = lines.slice(-20);
  let wi = '';
  try {
    // 世界書照平常的關鍵字規則掃：掃這次的請求和正文最後幾則（只看不觸發事件）
    const r = await c.getWorldInfoPrompt?.([prompt, ...scan].reverse(), 8192, true);
    wi = r?.worldInfoString || '';
  } catch { /* 掃不到就不帶 */ }
  return [
    ADULT_FRAME,
    `【角色：${ch.name}】`,
    description,
    personality ? `個性：${personality}` : '',
    scenario ? `情境：${scenario}` : '',
    // 玩家的設定是寫給模型看的，不是他知道的事：沒在劇情裡講過的，他不知道
    persona ? `【${c.name1}】（玩家角色的設定。${ch.name} 只知道劇情裡他看到、聽到或她親口說過的部分；還沒在劇情裡揭露的職業、家人、過去，他不知道）\n${persona}` : '',
    wi ? `【世界設定】\n${wi}` : '',
    recent.length ? `【正文最近的劇情】\n${recent.join('\n')}` : '',
    // 角色卡和世界書常寫著正文的演繹協定、輸出格式、狀態欄：模型照著寫就又長又慢（10/15 一句 LINE 等超過一分鐘）
    PHONE_MODE,
  ].filter(Boolean).join('\n\n');
}

// 角色卡常常規定每一樓都要附狀態欄（<khdata>、<UpdateVariable>⋯），模型在手機裡也照附。
// 手機只要說出口的字：任何 <標籤>…</標籤> 的區塊都拿掉，沒閉合的就從開頭標籤剪到最後。
const INLINE = /^(?:b|i|u|s|em|strong|br|span|small|p)$/i;
export function stripBlocks(text) {
  let t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<([A-Za-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g, (all, n) => (INLINE.test(n) ? all : ''));
  t = t.replace(/<([A-Za-z][\w-]*)\b[^>]*>[\s\S]*$/, (all, n) => (INLINE.test(n) ? all : ''));
  t = t.replace(/<\/?([A-Za-z][\w-]*)\b[^>]*\/?>/g, (all, n) => (INLINE.test(n) ? all : ''));
  return t.trim();
}

/**
 * 酒館這邊能不能把圖片送給模型：要用 Chat Completion，而且 AI 回應設定裡的「Send inline images」要打開。
 * 讀不到設定（舊版酒館）就當作可以，讓模型自己試
 */
export function canSeeImages() {
  const c = ctx();
  if (!c) return false;
  if (c.mainApi && c.mainApi !== 'openai') return false;
  const s = c.chatCompletionSettings;
  return !s || s.media_inlining !== false;
}

// 直接打酒館的 chat-completions（不經過擴充的事件），只在聊天接 Vertex／AI Studio 時用；拿不到字回空字串
// image 是 dataURL：直接塞成 image_url 區塊，酒館後端會轉成 Gemini 的 inline_data——
// 不經過酒館前端那張「這個模型看得到圖嗎」的名單（10/19 比比：Send inline media 開著，Gemini 4 還是看不到照片）
async function quickAsk(c, system, prompt, image) {
  const o = c.chatCompletionSettings || {};
  const src = o.chat_completion_source;
  const model = src === 'vertexai' ? o.vertexai_model : src === 'makersuite' ? o.google_model : '';
  if (!model) return '';
  try {
    const r = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST', headers: c.getRequestHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'system', content: system }, { role: 'user', content: image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] : prompt }],
        model, chat_completion_source: src, stream: false, max_tokens: 3000, temperature: o.temp_openai ?? 1,
        reasoning_effort: 'low', include_reasoning: false,
        enable_web_search: !!o.enable_web_search, // 酒館「啟用網路搜尋」開著就帶給 Gemini（10/19 比比：現實模式的他要有現實資訊）
        vertexai_auth_mode: o.vertexai_auth_mode, vertexai_region: o.vertexai_region, vertexai_express_project_id: o.vertexai_express_project_id,
        reverse_proxy: o.reverse_proxy, proxy_password: o.proxy_password,
      }),
    });
    if (!r.ok) return '';
    return String((await r.json())?.choices?.[0]?.message?.content || '').trim();
  } catch { return ''; }
}

/**
 * 叫模型寫東西。省 token 模式走 generateRaw（只帶角色卡、世界書、正文最後幾則）；
 * 關掉或有附圖時走 generateQuietPrompt（整份預設＋整段正文，跟正文一樣貴）。image 是 dataURL，酒館一次只吃一張
 */
export async function generate(prompt, image) {
  const c = ctx();
  if (!c) throw new Error('找不到酒館');
  const o = c.chatCompletionSettings || {};
  const google = c.mainApi === 'openai' && (o.chat_completion_source === 'makersuite' || o.chat_completion_source === 'vertexai');
  // 有照片又接 Google：直接問，照片一定送得到（酒館自己那條路會照模型名單決定要不要附圖，新模型常被漏掉）。問不到再退回酒館
  if (image && google) {
    const system = await liteContext(c, prompt);
    const fast = await quickAsk(c, system, prompt, image);
    if (fast) return stripBlocks(fast);
  }
  if (lite.get() && !image && c.generateRaw) {
    const system = await liteContext(c, prompt);
    // 聊天接 Google 時直接問模型：走酒館的 generateRaw 會經過模板、變數那些擴充，再照正文的思考設定想很久，
    // 一句 LINE 要等一兩分鐘（10/15 量到：準備 17 秒＋送出後一分多鐘；直接問六秒）。失敗才退回 generateRaw
    const fast = await quickAsk(c, system, prompt);
    if (fast) return stripBlocks(fast);
    const out = await c.generateRaw({ systemPrompt: system, prompt });
    return stripBlocks(out);
  }
  const fn = c.generateQuietPrompt;
  if (!fn) throw new Error('找不到酒館的生成功能');
  // 新版酒館吃物件參數，舊版吃一串位置參數
  const objectStyle = /^\s*(async\s+)?(function\s*\w*\s*)?\(\s*\{/.test(String(fn));
  const out = objectStyle
    ? await fn.call(c, { quietPrompt: prompt, skipWIAN: false, removeReasoning: true, ...(image ? { quietImage: image } : {}) })
    : await fn.call(c, prompt, false, false, image || null);
  return stripBlocks(out);
}

/**
 * 生一張圖，回傳圖片網址；都失敗回空字串。
 *   一、Gemini：借酒館存的 Vertex／AI Studio 設定，叫不到再用玩家貼在手機裡的 AI Studio 金鑰
 *   二、GPT（gpt-image-1）：用 OpenAI 玩酒館的玩家，文字和圖都走 GPT 就好（10/16 比比）。
 *       手機裡貼了 OpenAI 金鑰 → 帶證件照一起生（臉才對得上）；沒貼 → 借酒館存的 OpenAI 金鑰，只能看文字
 *   正文接 OpenAI 的先試 GPT，其他人先試 Gemini
 * 酒館擴充的 /imagine 不用：看不到證件照，畫出來是另一張臉
 */
/** 上一張圖是誰畫的、Gemini 為什麼沒畫（相本、IG 顯示給玩家看） */
export const imageInfo = { by: '', why: '', model: '' };

/** 手機現在畫得出圖嗎：聊天接 Google，或貼了 AI Studio 金鑰 */
export function canDraw() {
  const src = ctx()?.chatCompletionSettings?.chat_completion_source;
  return src === 'vertexai' || src === 'makersuite' || src === 'openai' || !!geminiKeyGet() || !!openaiKey.get();
}

export async function imagine(prompt, { refs = [], aspect = '1:1' } = {}) {
  refs = refs.filter((r) => r?.url);
  imageInfo.by = ''; imageInfo.why = ''; imageInfo.model = '';
  const gptFirst = ctx()?.chatCompletionSettings?.chat_completion_source === 'openai';
  if (gptFirst) { const o = await viaOpenAI(prompt, refs, aspect); if (o) { imageInfo.by = 'gpt'; return o; } }
  const g = (await viaGemini(prompt, refs, aspect)) || (await viaKey(prompt, refs, aspect));
  if (g) { imageInfo.by = 'gemini'; return g; }
  if (!gptFirst && openaiKey.get()) { const o = await viaOpenAI(prompt, refs, aspect); if (o) { imageInfo.by = 'gpt'; return o; } }
  return '';
}

// ---------- GPT 生圖 ----------
const OAI_KEY = 'brume-phone:openai-key';
/** 玩家貼在手機裡的 OpenAI 金鑰（只存在這台的瀏覽器） */
export const openaiKey = {
  get() { try { return localStorage.getItem(OAI_KEY) || ''; } catch { return ''; } },
  set(v) { try { if (v) localStorage.setItem(OAI_KEY, v); else localStorage.removeItem(OAI_KEY); } catch { /* 存不了 */ } },
};
const oaiSize = (aspect) => (aspect === '9:16' || aspect === '3:4' ? '1024x1536' : aspect === '4:3' || aspect === '16:9' ? '1536x1024' : '1024x1024');
const oaiWhy = (prev, msg) => { imageInfo.why = (prev ? prev + '；' : '') + msg; };

async function viaOpenAI(prompt, refs = [], aspect = '1:1') {
  const prev = imageInfo.why;
  const size = oaiSize(aspect); const quality = imageResPref.get() === '2K' ? 'high' : 'medium';
  const key = openaiKey.get();
  try {
    let b64 = '';
    if (key) {
      // 手機裡有金鑰：證件照一起送（edits 吃參考圖），臉才會像
      const req = await refRequest(prompt, refs);
      let r;
      if (req.images.length) {
        const fd = new FormData();
        fd.append('model', 'gpt-image-1'); fd.append('prompt', req.text); fd.append('size', size); fd.append('quality', quality); fd.append('moderation', 'low');
        for (const [i, url] of req.images.entries()) fd.append('image[]', await (await fetch(url)).blob(), `ref${i}.png`);
        r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
      } else {
        r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-image-1', prompt: req.text, size, quality, moderation: 'low', n: 1 }) });
      }
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        oaiWhy(prev, /moderation|safety|content_policy/i.test(t) ? 'GPT 把這張擋下來了（它比較嚴，親密的畫面常常不給畫）' : `GPT 回 ${r.status}${r.status === 401 ? '（OpenAI 金鑰不對）' : r.status === 429 ? '（額度用完或太頻繁）' : ''}`);
        return '';
      }
      b64 = (await r.json())?.data?.[0]?.b64_json || '';
    } else {
      // 沒貼金鑰：借酒館存的 OpenAI 金鑰。酒館這條只收文字，送不了證件照
      const c = ctx();
      if (c?.chatCompletionSettings?.chat_completion_source !== 'openai') return '';
      const req = await refRequest(prompt, []);
      const r = await fetch('/api/openai/generate-image', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ model: 'gpt-image-1', prompt: req.text, size, quality, moderation: 'low', n: 1 }) });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        oaiWhy(prev, /moderation|safety|content_policy/i.test(t) ? 'GPT 把這張擋下來了（它比較嚴，親密的畫面常常不給畫）' : `酒館的 OpenAI 回 ${r.status}${r.status === 400 ? '（酒館裡沒有存 OpenAI 金鑰）' : ''}`);
        return '';
      }
      b64 = (await r.json())?.data?.[0]?.b64_json || '';
      // 有證件照卻送不過去：提醒玩家貼金鑰（index.js 收到會跳提示，十分鐘一次）
      if (b64 && refs.length) window.dispatchEvent(new CustomEvent('bp-hint', { detail: 'GPT 這張沒看到證件照，臉可能不像。到相本 → 證件照頁貼一次 OpenAI 金鑰，之後就會帶照片一起畫。' }));
    }
    if (!b64) { oaiWhy(prev, 'GPT 沒有回圖'); return ''; }
    imageInfo.model = 'gpt-image-1';
    return await saveImage(b64, 'png');
  } catch (e) { oaiWhy(prev, `GPT 連不上（${e.message || e}）`); return ''; }
}

// flash 快（十幾秒），pro 慢一點（二十秒上下）但光影細節比較細。玩家在證件照頁選先用哪個，叫不到才換另一個
const GEMINI_IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];
const PREF = 'brume-phone:imgmodel';
export const imageModelPref = {
  get() { try { return localStorage.getItem(PREF) === 'pro' ? 'pro' : 'flash'; } catch { return 'flash'; } },
  set(v) { try { localStorage.setItem(PREF, v === 'pro' ? 'pro' : 'flash'); } catch { /* 存不了就照預設 */ } },
};
// 一次生幾張讓玩家挑（1、2、4），每台裝置各自記
const COUNT = 'brume-phone:imgcount';
export const imageCountPref = {
  get() { try { const n = +localStorage.getItem(COUNT); return [2, 4].includes(n) ? n : 1; } catch { return 1; } },
  set(n) { try { localStorage.setItem(COUNT, String([2, 4].includes(+n) ? +n : 1)); } catch { /* 存不了就照預設 */ } },
};

/** 刪掉存在酒館伺服器上、沒用到的圖（挑圖時沒選中的） */
export async function dropImage(url) {
  try {
    const c = ctx();
    await fetch('/api/images/delete', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({ path: String(url).replace(/^\//, '') }) });
  } catch { /* 刪不掉就留著 */ }
}

const byPref = (list) => (imageModelPref.get() === 'pro' ? [...list].sort((a, b) => /pro/.test(b) - /pro/.test(a)) : list);

// 第二條路：玩家貼在手機裡的 AI Studio 金鑰（跟電話的 Gemini 聲音共用同一把）。
// 酒館那條路會卡在酒館版本太舊、Vertex 地區沒有生圖模型、快速模式碰不到；這條直接從瀏覽器問 Google，不經過酒館
const KEY = 'brume-phone:gemini-key';
const geminiKeyGet = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
let keyModels = null;
async function imageModels(key) {
  if (keyModels) return keyModels;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, referrerPolicy: 'strict-origin-when-cross-origin' });
    const list = ((await r.json()).models || [])
      .filter((m) => /image/.test(m.name) && !/imagen/.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
    // flash 先（快），pro 後；新的版本號排前面
    list.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a, 'en', { numeric: true }));
    keyModels = list.length ? list.slice(0, 3) : ['gemini-2.5-flash-image'];
  } catch { keyModels = ['gemini-2.5-flash-image']; }
  return keyModels;
}
/**
 * 參考照片放最前面、一張一張講明是誰，文字放後面。
 * Pro 會照順序讀：照片排在一大段文字後面、只標一行「Reference」，它會把照片當補充資料、照文字自己想像臉
 * （10/14 同一張企鵝快照對照：照片在後三張兩張不像，照片在前兩張都像）。flash 不挑順序，這樣排也一樣好
 * 回傳 { images: [dataURL...], text }，兩條路各自包成自己的格式
 */
async function refRequest(prompt, refs) {
  const ask = `${P.ASK}\n${String(prompt).trim()}`;
  const got = [];
  for (const r of refs) { const url = await asDataUrl(r.url); if (url) got.push({ name: r.name, url, ghost: !!r.ghost }); }
  if (!got.length) return { images: [], text: ask };
  // ghost 是拍照的人：不能算進「裡面就是這些人」，不然 flash 會把他整個人畫進畫面（10/15 浴室門口多一個人）
  const intro = got.map((r, i) => (r.ghost ? P.GHOST_INTRO(r.name, i) : P.REF_INTRO(r.name, i))).join('\n');
  const rule = got.some((r) => !r.ghost) ? P.REF_RULE : P.GHOST_ONLY;
  return { images: got.map((r) => r.url), text: `${intro}\n${rule}\n\n${ask}` };
}

async function viaKey(prompt, refs = [], aspect = '1:1') {
  const key = geminiKeyGet(); const prev = imageInfo.why;
  if (!key) { imageInfo.why = (imageInfo.why ? imageInfo.why + '；' : '') + '手機裡也沒有貼 AI Studio 金鑰（電話的「他的聲音」或相本證件照頁可以貼）'; return ''; }
  const req = await refRequest(prompt, refs);
  const parts = [...req.images.map((url) => ({ inline_data: { mime_type: url.slice(5, url.indexOf(';')), data: url.slice(url.indexOf(',') + 1) } })), { text: req.text }];
  const safety = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({ category, threshold: 'BLOCK_NONE' }));
  for (const model of byPref(await imageModels(key))) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', referrerPolicy: 'strict-origin-when-cross-origin',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], safetySettings: safety, generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect, ...(/gemini-3/.test(model) ? { imageSize: imageResPref.get() } : {}) } } }),
      });
      if (!r.ok) { imageInfo.why = (prev ? prev + '；' : '') + `金鑰那條：${model} 回 ${r.status}${r.status === 429 ? '（額度用完或太頻繁）' : r.status === 400 ? '（金鑰或參數不對）' : r.status === 403 ? '（金鑰沒有權限，或限制了網站）' : ''}`; continue; }
      const img = (await r.json())?.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData;
      if (!img) { imageInfo.why = (prev ? prev + '；' : '') + '金鑰那條：這張被 Google 擋下來了（多半是太露骨）'; return ''; }
      imageInfo.model = model;
      return await saveImage(img.data, (img.mimeType || 'image/png').split('/')[1] || 'png');
    } catch (e) { imageInfo.why = (prev ? prev + '；' : '') + `金鑰那條：${model} 連不上（${e.message || e}）`; }
  }
  return '';
}

async function viaGemini(prompt, refs = [], aspect = '1:1') {
  const c = ctx(); const o = c?.chatCompletionSettings || {};
  const cur = o.chat_completion_source;
  // 正文換成別家（Claude、OpenRouter⋯）時，酒館裡存的 Google 金鑰、Vertex 設定其實都還在：直接指定 Google 來生圖。
  // 以前看到正文不是 Google 就放棄（10/16 比比換了正文的 API，生圖就斷了）
  const onGoogle = cur === 'vertexai' || cur === 'makersuite';
  const sources = onGoogle ? [cur] : ['vertexai', 'makersuite'];
  const req = await refRequest(prompt, refs);
  const content = req.images.length ? [...req.images.map((url) => ({ type: 'image_url', image_url: { url } })), { type: 'text', text: req.text }] : req.text;
  const order = byPref(GEMINI_IMAGE_MODELS);
  // 第一順位（玩家選的）失敗先等六秒再試一次：Pro 常常是短暫被擋速度，馬上退回 Flash 質感就掉了（10/14 五張有兩張這樣）。
  // 酒館把 Google 的錯誤一律回 500，分不出是不是被擋，所以只要失敗就重試
  const whys = [];
  for (const src of sources) {
  imageInfo.why = '';
  for (const model of [order[0], ...order]) {
    if (model === order[0] && imageInfo.why) await new Promise((res) => setTimeout(res, onGoogle ? 6000 : 0));
    try {
      const r = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST', headers: c.getRequestHeaders(),
        body: JSON.stringify({
          messages: [{ role: 'user', content }], model, chat_completion_source: src, stream: false,
          request_images: true, request_image_aspect_ratio: aspect, request_image_resolution: imageResPref.get(), max_tokens: 4096, temperature: 1,
          vertexai_auth_mode: o.vertexai_auth_mode, vertexai_region: o.vertexai_region, vertexai_express_project_id: o.vertexai_express_project_id,
          ...(onGoogle ? { reverse_proxy: o.reverse_proxy, proxy_password: o.proxy_password } : {}), // 別家的反代不能拿來接 Google
        }),
      });
      if (!r.ok) { imageInfo.why = `${model} 回 ${r.status}${r.status === 404 ? '（這個地區沒有這個模型）' : r.status === 429 ? '（額度用完或太頻繁）' : ''}`; continue; }
      const j = await r.json();
      // 酒館把 Gemini 的回應整理成 responseContent；舊版直接轉 Google 原本的 candidates，兩種都看
      const parts = j?.responseContent?.parts || j?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p.inlineData?.data)?.inlineData;
      if (!img) { imageInfo.why = '這張被 Google 擋下來了（多半是太露骨）'; return ''; } // 只回了文字＝這張被擋了（多半是太露骨），換模型也一樣，交給玩家拿 prompt 去外面生
      imageInfo.model = model;
      return await saveImage(img.data, (img.mimeType || 'image/png').split('/')[1] || 'png');
    } catch (e) { imageInfo.why = `${model} 連不上（${e.message || e}）`; /* 換下一個模型 */ }
  }
  whys.push(`${src === 'vertexai' ? 'Vertex' : 'AI Studio'}：${imageInfo.why}`);
  }
  imageInfo.why = onGoogle ? whys[0].replace(/^[^：]+：/, '') : `正文沒接 Google，改用酒館存的 Google 設定也沒成功（${whys.join('；')}）`;
  return '';
}

/**
 * 給模型看一張圖、問一句話，只送這兩樣（不帶預設和正文），回傳文字；不是接 Google 或失敗回空字串。
 * 用正文那條路帶圖會把整份預設一起送，又貴又容易 500（10/14 判斷畫風時踩到）
 */
export async function lookAt(text, img) {
  const c = ctx(); const o = c?.chatCompletionSettings || {};
  const src = o.chat_completion_source;
  const model = src === 'vertexai' ? o.vertexai_model : src === 'makersuite' ? o.google_model : '';
  if (!model || !img) return '';
  try {
    const r = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST', headers: c.getRequestHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: img } }] }],
        model, chat_completion_source: src, stream: false, max_tokens: 2048, temperature: 0.2,
        vertexai_auth_mode: o.vertexai_auth_mode, vertexai_region: o.vertexai_region, vertexai_express_project_id: o.vertexai_express_project_id,
        reverse_proxy: o.reverse_proxy, proxy_password: o.proxy_password,
      }),
    });
    if (!r.ok) return '';
    return String((await r.json())?.choices?.[0]?.message?.content || '').trim();
  } catch { return ''; }
}

// 參考圖要給 dataURL；角色卡頭像這種網址先抓下來縮到 768 寬（原檔常常一兩 MB）
export async function asDataUrl(url) {
  if (String(url).startsWith('data:')) return url;
  try {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const k = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.85);
  } catch { return ''; } // 抓不到就不帶這張參考
}

// 圖存到酒館伺服器的使用者圖片資料夾，手機只記網址。直接存 base64 會把瀏覽器的空間（約 5MB）一張就吃掉三分之一
// 預設 2K：全身照、遠景的臉才分得到夠多像素，五官不會糊掉（1K 時全身照的臉只有幾十個像素，10/14 測的）
// 1K 讓玩家自己選：Flash 一張便宜三分之一，近景、自拍差別不大（10/15 比比要的）
const RES = 'brume-phone:imgres';
export const imageResPref = {
  get() { try { return localStorage.getItem(RES) === '1K' ? '1K' : '2K'; } catch { return '2K'; } },
  set(v) { try { localStorage.setItem(RES, v === '1K' ? '1K' : '2K'); } catch { /* 存不了就照預設 */ } },
};

// 存檔前轉成 JPG：2K 的 PNG 一張好幾 MB，相本整本會同步到伺服器
async function toJpeg(base64, ext) {
  try {
    const bin = atob(base64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: `image/${ext}` }));
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return { data: cv.toDataURL('image/jpeg', 0.9).split(',')[1], ext: 'jpg' };
  } catch { return { data: base64, ext }; }
}

async function saveImage(base64, ext, folder) {
  ({ data: base64, ext } = await toJpeg(base64, ext));
  const c = ctx(); const ch = c.characters?.[c.characterId];
  const r = await fetch('/api/images/upload', {
    method: 'POST', headers: c.getRequestHeaders(),
    body: JSON.stringify({ image: base64, format: ext === 'jpeg' ? 'jpg' : ext, ch_name: folder || ch?.name || 'Brume Phone', filename: `brume-phone_${Date.now()}` }),
  });
  if (!r.ok) return '';
  return String((await r.json())?.path || '');
}

/**
 * 世界書人物表：這張卡綁的世界書（角色卡的、這個聊天的）每個條目的標題＋開頭一小段。
 * 手機寫 IG、脆、他的手機時常會自己帶出配角，可是世界書照關鍵字觸發，配角還沒被提到就叫不出來，
 * 模型只好自己幫他編身分（10/15 B Side 黑膠酒吧的老闆老吳變成獸醫）。先給一份簡表，誰是誰就對得上
 */
let rosterCache = { at: 0, key: '', text: '' };
export async function worldRoster() {
  const c = ctx(); const ch = c?.characters?.[c?.characterId];
  if (!c?.loadWorldInfo || !ch) return '';
  const books = [...new Set([ch.data?.extensions?.world, c.chatMetadata?.world_info].filter(Boolean))];
  const key = books.join('|');
  if (rosterCache.key === key && Date.now() - rosterCache.at < 60000) return rosterCache.text;
  const lines = [];
  for (const b of books) {
    const data = await c.loadWorldInfo(b).catch(() => null);
    for (const e of Object.values(data?.entries || {})) {
      if (e.disable || !e.content) continue;
      const name = String(e.comment || (e.key || [])[0] || '').trim();
      if (!name) continue;
      lines.push(`- ${name}：${String(e.content).replace(/\s+/g, ' ').slice(0, 70)}`);
      if (lines.length >= 40) break;
    }
  }
  const text = lines.length ? `【世界書條目簡表】（配角的身分、職業、地點照這裡；要寫到哪一條就照那條，不要另外編）\n${lines.join('\n')}` : '';
  rosterCache = { at: Date.now(), key, text };
  return text;
}

/** 把 dataURL 存到酒館伺服器的 Brume Phone 資料夾，回傳網址（存不了回傳空字串）。桌布、桌面照片用，手機和電腦才看得到同一張 */
export async function uploadImage(dataUrl) {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(String(dataUrl));
  if (!m) return '';
  try { return await saveImage(m[2], m[1], 'Brume Phone'); } catch { return ''; }
}

/** 正文最近幾則（給快照挑劇情用） */
export function recentChat(n = 12) {
  const c = ctx();
  return (c?.chat || []).map((m, i) => ({ i, m })).filter(({ m }) => !m.is_system && m.mes).slice(-n)
    .map(({ i, m }) => ({ i, who: m.is_user ? (c.name1 || '我') : m.name, text: String(m.mes).replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim() }));
}

/**
 * 把一條記憶寫進酒館的世界書：優先寫這個聊天綁的世界書（Memory Books 多半也寫這本），
 * 沒有就寫角色卡綁的那本。回傳 { ok, book } 或 { ok:false, why }
 */
export async function writeLore(text, keys = []) {
  const c = ctx();
  if (!c?.loadWorldInfo || !c?.saveWorldInfo) return { ok: false, why: '這個版本的酒館不支援' };
  const ch = c.characters?.[c.characterId];
  const book = c.chatMetadata?.world_info || ch?.data?.extensions?.world;
  if (!book) return { ok: false, why: '這個聊天和角色卡都沒有綁世界書' };
  const data = await c.loadWorldInfo(book).catch(() => null);
  if (!data?.entries) return { ok: false, why: `讀不到世界書「${book}」` };
  const uids = Object.keys(data.entries).map(Number).filter((n) => !Number.isNaN(n));
  const uid = uids.length ? Math.max(...uids) + 1 : 0;
  data.entries[uid] = {
    uid, key: keys, keysecondary: [], comment: '📱 霧語・LINE 記憶', content: text,
    constant: false, vectorized: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 100, position: 1, disable: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    delayUntilRecursion: 0, probability: 100, useProbability: true, depth: 4, group: '', groupOverride: false, groupWeight: 100,
    scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: '', role: 0,
    sticky: null, cooldown: null, delay: null, displayIndex: uid,
  };
  await c.saveWorldInfo(book, data, true);
  try { c.reloadWorldInfoEditor?.(book); } catch { /* 編輯器沒開就算了 */ }
  return { ok: true, book, uid };
}

/** 記憶書改了、刪了，世界書那條跟著動（10/19 比比：以前是單向的）。條目已經被玩家刪掉就當沒事 */
export async function updateLore(book, uid, text, keys) {
  const c = ctx(); if (!c?.loadWorldInfo || !c?.saveWorldInfo || !book) return false;
  const data = await c.loadWorldInfo(book).catch(() => null);
  const e = data?.entries?.[uid]; if (!e) return false;
  e.content = text; if (Array.isArray(keys) && keys.length) e.key = keys;
  await c.saveWorldInfo(book, data, true);
  try { c.reloadWorldInfoEditor?.(book); } catch { /* 編輯器沒開就算了 */ }
  return true;
}
export async function deleteLore(book, uid) {
  const c = ctx(); if (!c?.loadWorldInfo || !c?.saveWorldInfo || !book) return false;
  const data = await c.loadWorldInfo(book).catch(() => null);
  if (!data?.entries?.[uid]) return false;
  delete data.entries[uid];
  await c.saveWorldInfo(book, data, true);
  try { c.reloadWorldInfoEditor?.(book); } catch { /* 編輯器沒開就算了 */ }
  return true;
}

// 以前（0.9.2 以前）手機資料是照角色存的。這裡列出每一種資料的前綴，搬家時一起搬
export const DATA_PREFIXES = ['line', 'linebg', 'music', 'ig', 'threads', 'his', 'album', 'calls', 'rps', 'stage', 'notes', 'cal', 'memory', 'cards', 'couple', 'parcels', 'where', 'weather'];

/**
 * 把照片存到手機：iPhone、Android 走分享選單（裡面有「儲存影像」），電腦直接下載。
 * Safari 要分享得在按下去的當下，先抓圖再分享常被擋（NotAllowedError）：抓好的圖留著，叫她再按一次就是當下
 */
let shareCache = { key: '', files: [] };
export async function saveToPhone(urls, say) {
  urls = [...new Set(urls.filter(Boolean))];
  if (!urls.length) { say?.('這裡還沒有生好的照片'); return; }
  const key = urls.join('|');
  if (shareCache.key !== key) {
    say?.(urls.length > 1 ? `準備 ${urls.length} 張照片⋯` : '準備照片⋯');
    const files = [];
    for (const [i, u] of urls.entries()) {
      try {
        const b = await (await fetch(u)).blob();
        const ext = (b.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        files.push(new File([b], `brume-${new Date().toISOString().slice(0, 10)}-${i + 1}.${ext}`, { type: b.type || 'image/png' }));
      } catch { /* 抓不到的那張跳過 */ }
    }
    if (!files.length) { say?.('照片讀不到，可能被刪掉了'); return; }
    shareCache = { key, files };
  }
  const { files } = shareCache;
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files }); return; } catch (e) {
      if (e?.name === 'AbortError') return; // 她自己關掉分享選單
      if (e?.name === 'NotAllowedError') { say?.('照片準備好了，再按一次就能存'); return; }
    }
  }
  for (const f of files) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  say?.(files.length > 1 ? `下載了 ${files.length} 張` : '下載了');
}

/**
 * 這張卡用不用小手機（古風、奇幻這類沒有手機的世界）：關掉的卡不顯示手機按鈕、劇情不接手機、他不會主動傳。
 * 存在酒館的擴充設定裡，手機和電腦同一份（10/16 比比：小手機不適用每個角色）
 */
export const phoneOff = {
  list() { const s = ctx()?.extensionSettings?.['brume-phone']; return Array.isArray(s?.offCards) ? s.offCards : []; },
  is(charKey) { return !!charKey && phoneOff.list().includes(charKey); },
  set(charKey, off) {
    const c = ctx(); if (!c?.extensionSettings || !charKey) return;
    const s = (c.extensionSettings['brume-phone'] ||= {});
    const list = new Set(Array.isArray(s.offCards) ? s.offCards : []);
    if (off) list.add(charKey); else list.delete(charKey);
    s.offCards = [...list];
    c.saveSettingsDebounced?.();
  },
};
