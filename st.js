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

/** 用酒館自己的生成（看得到角色卡、世界書、正文）。image 是 dataURL，酒館一次只吃一張 */
export async function generate(prompt, image) {
  const c = ctx();
  const fn = c?.generateQuietPrompt;
  if (!fn) throw new Error('找不到酒館的生成功能');
  // 新版酒館吃物件參數，舊版吃一串位置參數
  const objectStyle = /^\s*(async\s+)?(function\s*\w*\s*)?\(\s*\{/.test(String(fn));
  const out = objectStyle
    ? await fn.call(c, { quietPrompt: prompt, skipWIAN: false, removeReasoning: true, ...(image ? { quietImage: image } : {}) })
    : await fn.call(c, prompt, false, false, image || null);
  return String(out || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
}
