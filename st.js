// 跟酒館打交道的共用小工具

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
  const recent = (c.chat || []).filter((m) => !m.is_system && m.mes).slice(-6)
    .map((m) => `${m.is_user ? c.name1 : m.name}：${String(m.mes).replace(/<[^>]+>/g, '').slice(0, 400)}`);
  let wi = '';
  try {
    // 世界書照平常的關鍵字規則掃：掃這次的請求和正文最後幾則（只看不觸發事件）
    const r = await c.getWorldInfoPrompt?.([prompt, ...recent].reverse(), 8192, true);
    wi = r?.worldInfoString || '';
  } catch { /* 掃不到就不帶 */ }
  return [
    ADULT_FRAME,
    `【角色：${ch.name}】`,
    description,
    personality ? `個性：${personality}` : '',
    scenario ? `情境：${scenario}` : '',
    persona ? `【${c.name1}】\n${persona}` : '',
    wi ? `【世界設定】\n${wi}` : '',
    recent.length ? `【正文最近的劇情】\n${recent.join('\n')}` : '',
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

/**
 * 叫模型寫東西。省 token 模式走 generateRaw（只帶角色卡、世界書、正文最後幾則）；
 * 關掉或有附圖時走 generateQuietPrompt（整份預設＋整段正文，跟正文一樣貴）。image 是 dataURL，酒館一次只吃一張
 */
export async function generate(prompt, image) {
  const c = ctx();
  if (!c) throw new Error('找不到酒館');
  if (lite.get() && !image && c.generateRaw) {
    const out = await c.generateRaw({ systemPrompt: await liteContext(c, prompt), prompt });
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
 * 生一張圖，回傳圖片網址；都失敗回空字串。只用 Gemini（10/14 比比定的：不要別家的生圖）：
 *   一、聊天接 Google（Vertex／AI Studio）→ 借酒館的連線叫 Gemini
 *   二、酒館那條叫不到 → 用玩家貼在手機裡的 AI Studio 金鑰直接問 Google
 * 酒館擴充的 /imagine（Imagen、GPT、Pollinations⋯）不用：看不到證件照，畫出來是另一張臉
 */
/** 上一張圖是誰畫的、Gemini 為什麼沒畫（相本、IG 顯示給玩家看） */
export const imageInfo = { by: '', why: '' };

/** 手機現在畫得出圖嗎：聊天接 Google，或貼了 AI Studio 金鑰 */
export function canDraw() {
  const src = ctx()?.chatCompletionSettings?.chat_completion_source;
  return src === 'vertexai' || src === 'makersuite' || !!geminiKeyGet();
}

export async function imagine(prompt, { refs = [], aspect = '1:1' } = {}) {
  refs = refs.filter((r) => r?.url);
  imageInfo.by = ''; imageInfo.why = '';
  const g = (await viaGemini(prompt, refs, aspect)) || (await viaKey(prompt, refs, aspect));
  if (g) imageInfo.by = 'gemini';
  return g;
}

// flash 快（十幾秒），pro 慢一點但細；flash 叫不到才換 pro
const GEMINI_IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];

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
async function viaKey(prompt, refs = [], aspect = '1:1') {
  const key = geminiKeyGet(); const prev = imageInfo.why;
  if (!key) { imageInfo.why = (imageInfo.why ? imageInfo.why + '；' : '') + '手機裡也沒有貼 AI Studio 金鑰（電話的「他的聲音」或相本證件照頁可以貼）'; return ''; }
  const parts = [{ text: `Generate one image. No text in the image, no captions.\n${String(prompt).trim()}${refs.length ? '\nReference images of the people in this picture follow. Keep each person\'s face, hair and overall look. Unless a visual style is given above, draw in the same art style as the references.' : ''}` }];
  for (const r of refs) {
    const url = await asDataUrl(r.url); if (!url) continue;
    parts.push({ text: `Reference: ${r.name}` }, { inline_data: { mime_type: url.slice(5, url.indexOf(';')), data: url.slice(url.indexOf(',') + 1) } });
  }
  const safety = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({ category, threshold: 'BLOCK_NONE' }));
  for (const model of await imageModels(key)) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', referrerPolicy: 'strict-origin-when-cross-origin',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], safetySettings: safety, generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect } } }),
      });
      if (!r.ok) { imageInfo.why = (prev ? prev + '；' : '') + `金鑰那條：${model} 回 ${r.status}${r.status === 429 ? '（額度用完或太頻繁）' : r.status === 400 ? '（金鑰或參數不對）' : r.status === 403 ? '（金鑰沒有權限，或限制了網站）' : ''}`; continue; }
      const img = (await r.json())?.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData;
      if (!img) { imageInfo.why = (prev ? prev + '；' : '') + '金鑰那條：這張被 Google 擋下來了（多半是太露骨）'; return ''; }
      return await saveImage(img.data, (img.mimeType || 'image/png').split('/')[1] || 'png');
    } catch (e) { imageInfo.why = (prev ? prev + '；' : '') + `金鑰那條：${model} 連不上（${e.message || e}）`; }
  }
  return '';
}

async function viaGemini(prompt, refs = [], aspect = '1:1') {
  const c = ctx(); const o = c?.chatCompletionSettings || {};
  const src = o.chat_completion_source;
  if (src !== 'vertexai' && src !== 'makersuite') { imageInfo.why = '酒館聊天沒有接 Google（Vertex 或 AI Studio）'; return ''; }
  const ask = `Generate one image. No text in the image, no captions.\n${String(prompt).trim()}`;
  // 參考圖一張一張標上是誰，畫出來的人才會對得上
  const content = refs.length
    ? [{ type: 'text', text: `${ask}\nReference images of the people in this picture follow. Keep each person's face, hair and overall look. Unless a visual style is given above, draw in the same art style as the references (anime stays anime, photo stays photo).` },
      ...(await Promise.all(refs.map(async (r) => { const url = await asDataUrl(r.url); return url ? [{ type: 'text', text: `Reference: ${r.name}` }, { type: 'image_url', image_url: { url } }] : []; }))).flat()]
    : ask;
  for (const model of GEMINI_IMAGE_MODELS) {
    try {
      const r = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST', headers: c.getRequestHeaders(),
        body: JSON.stringify({
          messages: [{ role: 'user', content }], model, chat_completion_source: src, stream: false,
          request_images: true, request_image_aspect_ratio: aspect, request_image_resolution: '1K', max_tokens: 4096, temperature: 1,
          vertexai_auth_mode: o.vertexai_auth_mode, vertexai_region: o.vertexai_region, vertexai_express_project_id: o.vertexai_express_project_id,
          reverse_proxy: o.reverse_proxy, proxy_password: o.proxy_password,
        }),
      });
      if (!r.ok) { imageInfo.why = `${model} 回 ${r.status}${r.status === 404 ? '（這個地區沒有這個模型）' : r.status === 429 ? '（額度用完或太頻繁）' : ''}`; continue; }
      const j = await r.json();
      // 酒館把 Gemini 的回應整理成 responseContent；舊版直接轉 Google 原本的 candidates，兩種都看
      const parts = j?.responseContent?.parts || j?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p.inlineData?.data)?.inlineData;
      if (!img) { imageInfo.why = '這張被 Google 擋下來了（多半是太露骨）'; return ''; } // 只回了文字＝這張被擋了（多半是太露骨），換模型也一樣，交給玩家拿 prompt 去外面生
      return await saveImage(img.data, (img.mimeType || 'image/png').split('/')[1] || 'png');
    } catch (e) { imageInfo.why = `${model} 連不上（${e.message || e}）`; /* 換下一個模型 */ }
  }
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
async function saveImage(base64, ext) {
  const c = ctx(); const ch = c.characters?.[c.characterId];
  const r = await fetch('/api/images/upload', {
    method: 'POST', headers: c.getRequestHeaders(),
    body: JSON.stringify({ image: base64, format: ext === 'jpeg' ? 'jpg' : ext, ch_name: ch?.name || 'Brume Phone', filename: `brume-phone_${Date.now()}` }),
  });
  if (!r.ok) return '';
  return String((await r.json())?.path || '');
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
    uid, key: keys, keysecondary: [], comment: '📱 Brume Phone・LINE 記憶', content: text,
    constant: false, vectorized: false, selective: true, selectiveLogic: 0, addMemo: true,
    order: 100, position: 1, disable: false, ignoreBudget: false, excludeRecursion: false, preventRecursion: false,
    delayUntilRecursion: 0, probability: 100, useProbability: true, depth: 4, group: '', groupOverride: false, groupWeight: 100,
    scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: '', role: 0,
    sticky: null, cooldown: null, delay: null, displayIndex: uid,
  };
  await c.saveWorldInfo(book, data, true);
  try { c.reloadWorldInfoEditor?.(book); } catch { /* 編輯器沒開就算了 */ }
  return { ok: true, book };
}

// 以前（0.9.2 以前）手機資料是照角色存的。這裡列出每一種資料的前綴，搬家時一起搬
export const DATA_PREFIXES = ['line', 'linebg', 'music', 'ig', 'threads', 'his', 'album', 'calls', 'rps', 'stage', 'notes', 'cal', 'memory', 'cards', 'couple'];
