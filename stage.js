// 關係階段：每個角色各自一個，玩家自己設。劇情裡關係往前一步時，手機會提醒要不要升級。
// 有些功能等關係到了才打開。

import * as store from './store.js';

export const STAGES = [
  { id: 'meet', name: '認識', tone: '剛認識不久，還在互相了解，有好感也會保持分寸' },
  { id: 'flirt', name: '曖昧', tone: '彼此有意思但還沒說破，會試探、會在意對方' },
  { id: 'dating', name: '交往', tone: '正在交往的情侶，親密、會撒嬌、會想念' },
  { id: 'living', name: '同居', tone: '交往中而且住在一起，生活緊緊交疊' },
  { id: 'married', name: '結婚', tone: '已經結婚的伴侶，是彼此的家人' },
];

// 功能 → 最低要到哪個階段
const UNLOCK = {
  proactive: 'flirt', // 他主動傳訊息（離開時、閒著時）
  cards: 'flirt', // 收藏字卡
  his: 'meet', // 偷看他的手機：隨時都可以（10/14 露比改的，原本要交往）
  sleep: 'dating', // 陪睡模式
  milestones: 'dating', // 里程碑
  couple: 'dating', // 情侶頭貼
  notes: 'living', // 冰箱門便條
};

const idx = (id) => Math.max(0, STAGES.findIndex((s) => s.id === id));
const cache = new Map();

export async function get(key) {
  if (!key) return 'meet';
  if (cache.has(key)) return cache.get(key);
  const v = (await store.get('stage:' + key).catch(() => null)) || 'meet';
  cache.set(key, v);
  return v;
}

export async function set(key, id) {
  cache.set(key, id);
  await store.set('stage:' + key, id).catch(() => {});
}

export const name = (id) => STAGES[idx(id)].name;
export const tone = (id) => STAGES[idx(id)].tone;
export const atLeast = (id, need) => idx(id) >= idx(need);
export const needFor = (feature) => name(UNLOCK[feature]);

/** 這個功能現在開了沒（cur 是目前階段 id） */
export const unlocked = (cur, feature) => atLeast(cur, UNLOCK[feature] || 'meet');

/** 模型提到的關係（中文）對回階段 id，對不到回 null */
export function fromWord(w) {
  const s = STAGES.find((x) => String(w || '').includes(x.name));
  return s ? s.id : null;
}

/** 資料搬家後清掉快取，下次重讀 */
export const forget = (key) => cache.delete(key);
