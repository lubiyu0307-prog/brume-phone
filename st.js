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
 * 生一張圖，回傳圖片網址；都失敗回空字串。
 *   一、玩家自己接了酒館的生圖（Image Generation 擴充）→ 走 /imagine
 *   二、沒接、或接了沒出圖，而聊天是接 Google（Vertex／AI Studio）→ 借酒館的連線叫 Gemini 生圖
 * 酒館擴充裡的 Google 只有 Imagen，Imagen 2026 年中已經停用，所以第二條才是 Google 玩家真正會走的路
 */
export async function imagine(prompt, { refs = [], aspect = '1:1' } = {}) {
  // 有參考圖（相本證件照區的照片）時先走 Gemini：/imagine 吃不了參考圖，畫出來會是另一張臉
  refs = refs.filter((r) => r?.url);
  if (refs.length) return (await viaGemini(prompt, refs, aspect)) || (await viaImagine(prompt));
  return (await viaImagine(prompt)) || (await viaGemini(prompt, [], aspect));
}

async function viaImagine(prompt) {
  const c = ctx();
  // 生圖擴充關著的時候沒有 /imagine，硬叫會跳「不認得的指令」
  if (!c?.executeSlashCommandsWithOptions || !c.SlashCommandParser?.commands?.imagine) return '';
  // | 會被當成指令分隔、{{ }} 會被當成巨集，先換掉
  const safe = String(prompt).replace(/[|{}]/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    const r = await c.executeSlashCommandsWithOptions(`/imagine quiet=true ${safe}`, { handleParserErrors: true });
    return String(r?.pipe || '').trim();
  } catch { return ''; }
}

// flash 快（十幾秒），pro 慢一點但細；flash 叫不到才換 pro
const GEMINI_IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];

async function viaGemini(prompt, refs = [], aspect = '1:1') {
  const c = ctx(); const o = c?.chatCompletionSettings || {};
  const src = o.chat_completion_source;
  if (src !== 'vertexai' && src !== 'makersuite') return '';
  const ask = `Generate one photo. No text in the image, no captions.\n${String(prompt).trim()}`;
  // 參考圖一張一張標上是誰，畫出來的人才會對得上
  const content = refs.length
    ? [{ type: 'text', text: `${ask}\nReference photos of the people in this photo follow. Keep each person's face, hair and overall look.` },
      ...refs.flatMap((r) => [{ type: 'text', text: `Reference: ${r.name}` }, { type: 'image_url', image_url: { url: r.url } }])]
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
      if (!r.ok) continue;
      const j = await r.json();
      // 酒館把 Gemini 的回應整理成 responseContent；舊版直接轉 Google 原本的 candidates，兩種都看
      const parts = j?.responseContent?.parts || j?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p.inlineData?.data)?.inlineData;
      if (!img) return ''; // 只回了文字＝這張被擋了（多半是太露骨），換模型也一樣，交給玩家拿 prompt 去外面生
      return await saveImage(img.data, (img.mimeType || 'image/png').split('/')[1] || 'png');
    } catch { /* 換下一個模型 */ }
  }
  return '';
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
