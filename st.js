// 跟酒館打交道的共用小工具

export const ctx = () => window.SillyTavern?.getContext?.();

/** 現在開著的角色；沒選角色或在群組聊天時回 null */
export function currentChar() {
  const c = ctx();
  if (!c || c.groupId || c.characterId === undefined || c.characterId === null) return null;
  const ch = c.characters?.[c.characterId];
  if (!ch) return null;
  return {
    key: ch.avatar || ch.name,
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
    `【角色：${ch.name}】`,
    description,
    personality ? `個性：${personality}` : '',
    scenario ? `情境：${scenario}` : '',
    persona ? `【${c.name1}】\n${persona}` : '',
    wi ? `【世界設定】\n${wi}` : '',
    recent.length ? `【正文最近的劇情】\n${recent.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
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
    return String(out || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  }
  const fn = c.generateQuietPrompt;
  if (!fn) throw new Error('找不到酒館的生成功能');
  // 新版酒館吃物件參數，舊版吃一串位置參數
  const objectStyle = /^\s*(async\s+)?(function\s*\w*\s*)?\(\s*\{/.test(String(fn));
  const out = objectStyle
    ? await fn.call(c, { quietPrompt: prompt, skipWIAN: false, removeReasoning: true, ...(image ? { quietImage: image } : {}) })
    : await fn.call(c, prompt, false, false, image || null);
  return String(out || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
}

/** 叫酒館的生圖（Image Generation 擴充）。回傳圖片網址；沒接生圖或失敗回空字串 */
export async function imagine(prompt) {
  const c = ctx();
  if (!c?.executeSlashCommandsWithOptions) return '';
  // | 會被當成指令分隔、{{ }} 會被當成巨集，先換掉
  const safe = String(prompt).replace(/[|{}]/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    const r = await c.executeSlashCommandsWithOptions(`/imagine quiet=true ${safe}`, { handleParserErrors: true });
    return String(r?.pipe || '').trim();
  } catch { return ''; }
}

/** 正文最近幾則（給快照挑劇情用） */
export function recentChat(n = 12) {
  const c = ctx();
  return (c?.chat || []).map((m, i) => ({ i, m })).filter(({ m }) => !m.is_system && m.mes).slice(-n)
    .map(({ i, m }) => ({ i, who: m.is_user ? (c.name1 || '我') : m.name, text: String(m.mes).replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim() }));
}
