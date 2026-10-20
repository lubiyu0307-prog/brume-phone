// 跟「腦子」打交道的共用小工具（Discord 版）。
// 原版接酒館；這版沒有酒館：角色和玩家的設定從 kv 的 profile 來（Discord 那邊寫），
// 叫模型寫東西、生圖都直接從瀏覽器問 Google（玩家貼在手機裡的 AI Studio 金鑰），GPT 生圖照原版用 OpenAI 金鑰。

import { P } from './prompts.js';
import * as store from './store.js';

// ---------- 假的酒館 context：舊程式會來讀 extensionSettings、name1 這些 ----------
const EXT = 'wuyu:ext';
const loadExt = () => { try { return JSON.parse(localStorage.getItem(EXT) || '{}'); } catch { return {}; } };
const fake = {
  extensionSettings: { 'brume-phone': loadExt() },
  saveSettingsDebounced() { try { localStorage.setItem(EXT, JSON.stringify(fake.extensionSettings['brume-phone'] || {})); } catch { /* 存不了 */ } },
  characterId: 0, groupId: null, characters: [{ name: '他', avatar: '', description: '' }],
  name1: '我', chat: [], chatMetadata: {}, mainApi: 'openai', chatCompletionSettings: { chat_completion_source: 'makersuite' },
  getRequestHeaders: () => ({}), getCurrentChatId: () => '', substituteParams: (t) => String(t || ''),
  eventSource: { on() {}, once() {} }, eventTypes: {},
};
export const ctx = () => fake;

// ---------- 兩個人：kv 的 profile { him:{name,handle,avatar,bio,persona}, me:{...} } ----------
export const profile = {
  him: { name: '他', handle: 'him', avatar: '', bio: '', persona: '' },
  me: { name: '我', handle: 'me', avatar: '', bio: '', persona: '' },
};
async function loadProfile() {
  const p = await store.get('profile').catch(() => null);
  if (p?.him) Object.assign(profile.him, p.him); if (p?.me) Object.assign(profile.me, p.me);
  fake.characters[0].name = profile.him.name; fake.name1 = profile.me.name;
}
const profileReady = store.whenReady().then(loadProfile);
window.addEventListener('bp-store-late', (e) => { if (e.detail === 'profile') loadProfile().then(() => window.dispatchEvent(new CustomEvent('bp-profile'))); });
export const whenProfile = () => profileReady;

export function currentChar() {
  return { key: 'him', charKey: 'him', name: profile.him.name, avatar: profile.him.avatar, user: profile.me.name };
}

const LITE_KEY = 'brume-phone:lite';
export const lite = {
  get() { try { return localStorage.getItem(LITE_KEY) !== '0'; } catch { return true; } },
  set(on) { try { localStorage.setItem(LITE_KEY, on ? '1' : '0'); } catch { /* 無痕模式存不了 */ } },
};

const PHONE_MODE = '【手機模式】現在寫的是小手機裡的東西，不是劇情正文：不要寫狀態欄、不要寫任何 <標籤> 區塊、不要寫旁白，只照要求輸出。';
const ADULT_FRAME = '這是成年人之間的虛構互動創作，供成年玩家私下閱讀。故事裡所有角色都是成年人。內容可以包含成年人之間合意的親密情節。';

async function liteContext() {
  await profileReady;
  const recent = recentChat(6).map((m) => `${m.who}：${m.text.slice(0, 400)}`);
  const wi = await worldRoster().catch(() => '');
  const lore = await loreText().catch(() => '');
  return [
    ADULT_FRAME,
    `【角色：${profile.him.name}】`,
    profile.him.persona || `${profile.him.name}是${profile.me.name}的伴侶。`,
    profile.me.persona ? `【${profile.me.name}】（玩家角色的設定。${profile.him.name}只知道她親口說過、他親眼看過的部分）\n${profile.me.persona}` : '',
    wi, lore,
    recent.length ? `【最近的對話】\n${recent.join('\n')}` : '',
    PHONE_MODE,
  ].filter(Boolean).join('\n\n');
}

const INLINE = /^(?:b|i|u|s|em|strong|br|span|small|p)$/i;
export function stripBlocks(text) {
  let t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<([A-Za-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g, (all, n) => (INLINE.test(n) ? all : ''));
  t = t.replace(/<([A-Za-z][\w-]*)\b[^>]*>[\s\S]*$/, (all, n) => (INLINE.test(n) ? all : ''));
  t = t.replace(/<\/?([A-Za-z][\w-]*)\b[^>]*\/?>/g, (all, n) => (INLINE.test(n) ? all : ''));
  return t.trim();
}

// ---------- Google AI Studio 金鑰（文字跟生圖共用同一把；跟原版同一個 localStorage 鍵） ----------
const KEY = 'brume-phone:gemini-key';
export const geminiKey = {
  get() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* 存不了 */ } keyModels = null; textModel = ''; allModels = null; vertexMode = false; },
};
const geminiKeyGet = () => geminiKey.get();
const TEXT_MODEL = 'wuyu:textmodel';
export const textModelPref = {
  get() { try { return localStorage.getItem(TEXT_MODEL) || ''; } catch { return ''; } },
  set(v) { try { if (v) localStorage.setItem(TEXT_MODEL, v); else localStorage.removeItem(TEXT_MODEL); } catch { /* 存不了 */ } textModel = ''; },
};
// 金鑰兩種都吃：AI Studio 的問 generativelanguage；Vertex 快速模式的問 aiplatform 的 publishers 路徑。
// 看開頭認不出來（10/20：反重力給的 Gemini API 金鑰也是 AQ. 開頭，卻走 AI Studio 那條），
// 所以貼進來先問 AI Studio 列不列得出模型，列得出就走那條，列不出就當 Vertex（快速模式沒有列模型的 API，名單先寫死）
const G = 'https://generativelanguage.googleapis.com/v1beta';
let vertexMode = false;
const modelUrl = (key, model) => (vertexMode ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent` : `${G}/models/${model}:generateContent`);
const VERTEX_MODELS = ['gemini-3.1-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-image', 'gemini-3-pro-image'];
let allModels = null; let listing = null;
function listModels(key) {
  if (allModels) return Promise.resolve(allModels);
  if (listing) return listing;
  listing = (async () => {
    try {
      const r = await fetch(`${G}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, referrerPolicy: 'strict-origin-when-cross-origin' });
      const list = r.ok ? ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, '')) : [];
      if (list.length) { vertexMode = false; allModels = list; } else { vertexMode = true; allModels = [...VERTEX_MODELS]; }
    } catch { vertexMode = true; allModels = [...VERTEX_MODELS]; }
    listing = null;
    return allModels;
  })();
  return listing;
}
export const keyRoute = () => (allModels ? (vertexMode ? 'Vertex' : 'AI Studio') : '');
let textModel = '';
async function pickTextModel(key) {
  if (textModel) return textModel;
  const want = textModelPref.get(); if (want) return (textModel = want);
  const list = (await listModels(key)).filter((n) => /^gemini-/.test(n) && !/image|tts|audio|embedding|live|robotics|computer|omni/.test(n) && !/-exp|-preview/.test(n));
  // 有 flash-latest 就用它（Google 自己指向最新的 flash）；沒有就 flash 優先、新版本排前面
  list.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a, 'en', { numeric: true }));
  textModel = list.find((n) => n === 'gemini-flash-latest') || list[0] || 'gemini-2.5-flash';
  return textModel;
}
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({ category, threshold: 'BLOCK_NONE' }));
const WHY = { 400: '金鑰或參數不對', 401: '金鑰不對', 403: '金鑰沒有權限（或限制了網站）', 429: '額度用完或太頻繁', 503: 'Google 那邊忙，等一下再試' };

export function canSeeImages() { return !!geminiKeyGet(); }
const inlinePart = (url) => ({ inline_data: { mime_type: url.slice(5, url.indexOf(';')), data: url.slice(url.indexOf(',') + 1) } });

// 腦子：kv 的 brain 有設（格的酒館橋）就先問他本人，推播站代轉；他沒接到才退回手機裡的 Gemini（10/20 比比：字要從格那邊來）
export const brain = { on: false, why: '' };
store.whenReady().then(async () => { brain.on = !!(await store.get('brain').catch(() => null))?.url; });
window.addEventListener('bp-store-late', async (e) => { if (e.detail === 'brain') brain.on = !!(await store.get('brain').catch(() => null))?.url; });
async function askBrain(system, prompt, image) {
  const r = await fetch(store.api('ask'), { method: 'POST', headers: { ...store.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ system, prompt, ...(image ? { image } : {}) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `腦子回 ${r.status}`);
  if (!j.text) throw new Error('他什麼都沒寫');
  return j.text;
}

/** 叫模型寫東西。image 是 dataURL */
export async function generate(prompt, image) {
  const key = geminiKeyGet();
  const system = await liteContext();
  if (brain.on) {
    try { return stripBlocks(await askBrain(system, prompt, image)); } catch (e) {
      brain.why = e.message || String(e);
      if (!key) throw new Error(`格沒接到（${brain.why}）`);
      window.dispatchEvent(new CustomEvent('bp-hint', { detail: `格沒接到（${brain.why}），這句先讓 Gemini 寫` }));
    }
  }
  if (!key) throw new Error('還沒貼金鑰：設定 → 腦子，貼一把 AI Studio 或 Vertex 的金鑰');
  const model = await pickTextModel(key);
  const parts = [...(image ? [inlinePart(image)] : []), { text: prompt }];
  let r;
  try {
    r = await fetch(modelUrl(key, model), {
      method: 'POST', referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }], safetySettings: SAFETY, generationConfig: { temperature: 1, maxOutputTokens: 3000, ...(/gemini-(2\.5|3)/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }),
    });
  } catch (e) { throw new Error(`連不到 Google（${e.message || e}）`); }
  if (r.status === 404 && !textModelPref.get() && (allModels || []).includes(model) && !generate.retried) {
    // 這把金鑰沒有這個模型（Vertex 各地區不一樣）：從名單拿掉，換下一個再試一次
    allModels = allModels.filter((m) => m !== model); textModel = ''; generate.retried = true;
    try { return await generate(prompt, image); } finally { generate.retried = false; }
  }
  if (!r.ok) throw new Error(`${model} 回 ${r.status}${WHY[r.status] ? `（${WHY[r.status]}）` : ''}`);
  const j = await r.json();
  const text = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error(j?.candidates?.[0]?.finishReason === 'SAFETY' || j?.promptFeedback?.blockReason ? '這題被 Google 擋了' : '他什麼都沒寫');
  return stripBlocks(text);
}

// ---------- 生圖（照原版：Gemini 用金鑰直接問；GPT 用 OpenAI 金鑰） ----------
export const imageInfo = { by: '', why: '', model: '', switched: '' };
export function canDraw() { return !!geminiKeyGet() || !!openaiKey.get(); }

export async function imagine(prompt, { refs = [], aspect = '1:1', engine = '' } = {}) {
  refs = refs.filter((r) => r?.url);
  imageInfo.by = ''; imageInfo.why = ''; imageInfo.model = ''; imageInfo.switched = '';
  const have = engines();
  const want = (engine === 'gpt' || engine === 'gemini') ? engine : imageEnginePref.get();
  const gpt = async () => { const o = await viaOpenAI(prompt, refs, aspect); if (o) imageInfo.by = 'gpt'; return o; };
  const gem = async () => { const g = await viaKey(prompt, refs, aspect); if (g) imageInfo.by = 'gemini'; return g; };
  const first = want === 'gpt' ? gpt : gem; const second = want === 'gpt' ? gem : gpt;
  const firstName = want === 'gpt' ? 'GPT' : 'Gemini'; const secondName = want === 'gpt' ? 'Gemini' : 'GPT';
  const u = await first(); if (u) return u;
  const firstWhy = imageInfo.why;
  if (!(want === 'gpt' ? have.gemini : have.gpt)) { imageInfo.why = `${firstName}：${firstWhy}`; return ''; }
  imageInfo.why = '';
  const v = await second();
  if (v) { imageInfo.switched = `${firstName} 沒畫出來（${firstWhy}），這張換 ${secondName} 畫的`; window.dispatchEvent(new CustomEvent('bp-hint', { detail: imageInfo.switched })); return v; }
  imageInfo.why = `${firstName}：${firstWhy}；${secondName}：${imageInfo.why}`;
  return '';
}
export function engines() { return { gemini: !!geminiKeyGet(), gpt: !!openaiKey.get() }; }
export const shouldAskEngine = () => { const h = engines(); return h.gemini && h.gpt; };
const ENGINE = 'brume-phone:imgengine';
export const imageEnginePref = {
  get() {
    const h = engines(); let v = ''; try { v = localStorage.getItem(ENGINE) || ''; } catch { /* 讀不到 */ }
    if (v === 'gpt' && h.gpt) return 'gpt'; if (v === 'gemini' && h.gemini) return 'gemini';
    return h.gemini ? 'gemini' : h.gpt ? 'gpt' : 'gemini';
  },
  set(v) { try { localStorage.setItem(ENGINE, v === 'gpt' ? 'gpt' : 'gemini'); } catch { /* 存不了 */ } },
};
const OAI_KEY = 'brume-phone:openai-key';
const OAI_MODEL = 'gpt-image-2';
export const openaiKey = {
  get() { try { return localStorage.getItem(OAI_KEY) || ''; } catch { return ''; } },
  set(v) { try { if (v) localStorage.setItem(OAI_KEY, v); else localStorage.removeItem(OAI_KEY); } catch { /* 存不了 */ } },
};
const oaiSize = (aspect) => (aspect === '9:16' || aspect === '3:4' ? '1024x1536' : aspect === '4:3' || aspect === '16:9' ? '1536x1024' : '1024x1024');
const oaiWhy = (prev, msg) => { imageInfo.why = (prev ? prev + '；' : '') + msg; };
async function viaOpenAI(prompt, refs = [], aspect = '1:1') {
  const prev = imageInfo.why;
  const size = oaiSize(aspect); const quality = imageResPref.get() === '2K' ? 'high' : 'low';
  const key = openaiKey.get();
  if (!key) { oaiWhy(prev, '沒有貼 OpenAI 金鑰'); return ''; }
  try {
    const req = await refRequest(prompt, refs);
    let r;
    if (req.images.length) {
      const fd = new FormData();
      fd.append('model', OAI_MODEL); fd.append('prompt', req.text); fd.append('size', size); fd.append('quality', quality); fd.append('moderation', 'low');
      for (const [i, url] of req.images.entries()) fd.append('image[]', await (await fetch(url)).blob(), `ref${i}.png`);
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: OAI_MODEL, prompt: req.text, size, quality, moderation: 'low', n: 1 }) });
    }
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      oaiWhy(prev, /moderation|safety|content_policy/i.test(t) ? 'GPT 不給這張（審查已經調到最低，裸露、床上的畫面它還是擋）' : `GPT 回 ${r.status}${r.status === 401 ? '（OpenAI 金鑰不對）' : r.status === 429 ? '（額度用完或太頻繁）' : ''}`);
      return '';
    }
    const b64 = (await r.json())?.data?.[0]?.b64_json || '';
    if (!b64) { oaiWhy(prev, 'GPT 沒有回圖'); return ''; }
    imageInfo.model = OAI_MODEL;
    return await saveImage(b64, 'png');
  } catch (e) { oaiWhy(prev, `GPT 連不上（${e.message || e}）`); return ''; }
}
const PREF = 'brume-phone:imgmodel';
export const imageModelPref = {
  get() { try { return localStorage.getItem(PREF) === 'pro' ? 'pro' : 'flash'; } catch { return 'flash'; } },
  set(v) { try { localStorage.setItem(PREF, v === 'pro' ? 'pro' : 'flash'); } catch { /* 存不了 */ } },
};
export const imageCountPref = { get: () => 1, set() {} };
export async function dropImage(url) { await store.dropAsset(url); }
const byPref = (list) => (imageModelPref.get() === 'pro' ? [...list].sort((a, b) => /pro/.test(b) - /pro/.test(a)) : list);
let keyModels = null;
async function imageModels(key) {
  if (keyModels) return keyModels;
  const list = (await listModels(key)).filter((n) => /image/.test(n) && !/imagen|preview|lite/.test(n));
  list.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a, 'en', { numeric: true }));
  keyModels = list.length ? list.slice(0, 3) : ['gemini-2.5-flash-image'];
  return keyModels;
}
async function refRequest(prompt, refs) {
  const ask = `${P.ASK}\n${String(prompt).trim()}`;
  const got = [];
  for (const r of refs) { const url = await asDataUrl(r.url); if (url) got.push({ name: r.name, url, ghost: !!r.ghost }); }
  if (!got.length) return { images: [], text: ask };
  const intro = got.map((r, i) => (r.ghost ? P.GHOST_INTRO(r.name, i) : P.REF_INTRO(r.name, i))).join('\n');
  const rule = got.some((r) => !r.ghost) ? P.REF_RULE : P.GHOST_ONLY;
  return { images: got.map((r) => r.url), text: `${intro}\n${rule}\n\n${ask}` };
}
async function viaKey(prompt, refs = [], aspect = '1:1') {
  const key = geminiKeyGet(); const prev = imageInfo.why;
  if (!key) { imageInfo.why = (prev ? prev + '；' : '') + '沒有貼 Google 的金鑰（設定 → 腦子）'; return ''; }
  const req = await refRequest(prompt, refs);
  const parts = [...req.images.map(inlinePart), { text: req.text }];
  for (const model of byPref(await imageModels(key))) {
    try {
      const r = await fetch(modelUrl(key, model), {
        method: 'POST', referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], safetySettings: SAFETY, generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect, ...(/gemini-3/.test(model) ? { imageSize: imageResPref.get() } : {}) } } }),
      });
      if (!r.ok) { imageInfo.why = (prev ? prev + '；' : '') + `${model} 回 ${r.status}${WHY[r.status] ? `（${WHY[r.status]}）` : ''}`; continue; }
      const img = (await r.json())?.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData;
      if (!img) { imageInfo.why = (prev ? prev + '；' : '') + '這張被 Google 擋下來了（多半是太露骨）'; return ''; }
      imageInfo.model = model;
      return await saveImage(img.data, (img.mimeType || 'image/png').split('/')[1] || 'png');
    } catch (e) { imageInfo.why = (prev ? prev + '；' : '') + `${model} 連不上（${e.message || e}）`; }
  }
  return '';
}

/** 給模型看一張圖、問一句話 */
export async function lookAt(text, img) {
  const key = geminiKeyGet(); if (!key || !img) return '';
  try {
    const r = await fetch(modelUrl(key, await pickTextModel(key)), {
      method: 'POST', referrerPolicy: 'strict-origin-when-cross-origin', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [inlinePart(img), { text }] }], safetySettings: SAFETY, generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } }),
    });
    if (!r.ok) return '';
    return ((await r.json())?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  } catch { return ''; }
}

export async function asDataUrl(url) {
  if (String(url).startsWith('data:')) return url;
  try {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const k = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.85);
  } catch { return ''; }
}
const RES = 'brume-phone:imgres';
export const imageResPref = {
  get() { try { return localStorage.getItem(RES) === '1K' ? '1K' : '2K'; } catch { return '2K'; } },
  set(v) { try { localStorage.setItem(RES, v === '1K' ? '1K' : '2K'); } catch { /* 存不了 */ } },
};
async function toJpeg(base64, ext) {
  try {
    const bin = atob(base64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: `image/${ext}` }));
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return cv.toDataURL('image/jpeg', 0.9);
  } catch { return `data:image/${ext};base64,${base64}`; }
}
async function saveImage(base64, ext) { return store.putImage(await toJpeg(base64, ext)); }

// ---------- 世界設定、最近對話、記憶：kv 的 roster、recent、lore（格在 Discord 那邊寫） ----------
export async function worldRoster() {
  const t = String((await store.get('roster').catch(() => null))?.text || '').trim();
  return t ? `【世界設定】（配角、地點照這裡；要寫到哪一條就照那條，不要另外編）\n${t}` : '';
}
async function loreText() {
  const items = ((await store.get('lore').catch(() => null)) || []).filter((x) => x?.text).slice(-40);
  return items.length ? `【他記得的事】\n${items.map((x) => `- ${x.text}`).join('\n')}` : '';
}
export function storyText(mes) { return stripBlocks(String(mes || '')).replace(/<[^>]+>/g, '').trim(); }
let recentCache = [];
store.whenReady().then(async () => { recentCache = (await store.get('recent').catch(() => null))?.lines || []; });
window.addEventListener('bp-store-late', async (e) => { if (e.detail === 'recent') recentCache = (await store.get('recent').catch(() => null))?.lines || []; });
export function recentChat(n = 12) {
  return (Array.isArray(recentCache) ? recentCache : []).slice(-n).map((m, i) => ({ i, who: m.who || '', text: storyText(m.text) })).filter((m) => m.text);
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export async function writeLore(text, keys = []) {
  try { const list = (await store.get('lore')) || []; const id = uid(); list.push({ id, text, keys, ts: Date.now() }); await store.set('lore', list); return { ok: true, book: '格的記憶', uid: id }; } catch (e) { return { ok: false, why: e?.message || '寫不進去' }; }
}
export async function updateLore(book, uid_, text, keys) {
  try { const list = (await store.get('lore')) || []; const x = list.find((y) => y.id === uid_); if (!x) return false; x.text = text; if (Array.isArray(keys) && keys.length) x.keys = keys; await store.set('lore', list); return true; } catch { return false; }
}
export async function deleteLore(book, uid_) {
  try { const list = (await store.get('lore')) || []; if (!list.some((y) => y.id === uid_)) return false; await store.set('lore', list.filter((y) => y.id !== uid_)); return true; } catch { return false; }
}

export const DATA_PREFIXES = ['line', 'linebg', 'music', 'ig', 'threads', 'his', 'album', 'calls', 'rps', 'stage', 'notes', 'cal', 'memory', 'cards', 'couple', 'parcels', 'where', 'weather'];
export async function uploadImage(dataUrl) { return store.putImage(dataUrl); }

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
      if (e?.name === 'AbortError') return;
      if (e?.name === 'NotAllowedError') { say?.('照片準備好了，再按一次就能存'); return; }
    }
  }
  for (const f of files) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  say?.(files.length > 1 ? `下載了 ${files.length} 張` : '下載了');
}

export const phoneOff = { list: () => [], is: () => false, set() {} };
