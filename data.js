// 每個角色各自的小資料：便條、行事曆、記憶書、字卡。全部存在 IndexedDB。

import * as store from './store.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const listeners = new Set();

async function list(kind, key) {
  return (await store.get(`${kind}:${key}`).catch(() => null)) || [];
}
async function save(kind, key, arr) {
  await store.set(`${kind}:${key}`, arr).catch(() => {});
  for (const f of listeners) f(kind, key);
}

export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

// 便條：{ id, text, date?, by: 'him'|'me', done, ts }
export const notes = {
  all: (key) => list('notes', key),
  async add(key, n) { const a = await list('notes', key); a.unshift({ id: uid(), ts: Date.now(), done: false, ...n }); await save('notes', key, a); },
  async update(key, id, patch) { const a = await list('notes', key); const n = a.find((x) => x.id === id); if (n) Object.assign(n, patch); await save('notes', key, a); },
  async remove(key, id) { await save('notes', key, (await list('notes', key)).filter((x) => x.id !== id)); },
};

// 行事曆：{ id, date: 'YYYY-MM-DD', title, by, ts, kind: 'story'|'real' }
// 分兩本（10/17 比比）：劇情裡的日子和現實的日子常對不上，放同一本怎麼對都怪。舊的沒標 kind 的當劇情
export const calKind = (e) => (e.kind === 'real' ? 'real' : 'story');
export const cal = {
  all: (key) => list('cal', key),
  async add(key, e) {
    const a = await list('cal', key);
    // 同一天同一件事只記一次（重新生成時不會重複落地）
    if (a.some((x) => x.date === e.date && x.title === e.title && calKind(x) === calKind(e))) return;
    a.push({ id: uid(), ts: Date.now(), ...e }); a.sort((x, y) => x.date.localeCompare(y.date));
    await save('cal', key, a);
  },
  async remove(key, id) { await save('cal', key, (await list('cal', key)).filter((x) => x.id !== id)); },
};

// 記憶書：{ id, text, ts }
export const memory = {
  all: (key) => list('memory', key),
  async add(key, text, extra = {}) { const a = await list('memory', key); const m = { id: uid(), ts: Date.now(), text, ...extra }; a.push(m); await save('memory', key, a); return m; },
  // patch 可以是字串（只改內容）或物件（改 kind、lore 這些）
  async update(key, id, patch) { const a = await list('memory', key); const m = a.find((x) => x.id === id); if (m) Object.assign(m, typeof patch === 'string' ? { text: patch } : patch); await save('memory', key, a); },
  async remove(key, id) { await save('memory', key, (await list('memory', key)).filter((x) => x.id !== id)); },
};

// 字卡（收藏的句子）：{ id, text, who, ts }
export const cards = {
  all: (key) => list('cards', key),
  async add(key, c) { const a = await list('cards', key); a.unshift({ id: uid(), ts: Date.now(), ...c }); await save('cards', key, a); },
  async remove(key, id) { await save('cards', key, (await list('cards', key)).filter((x) => x.id !== id)); },
};

// 貼圖庫（所有角色共用）：{ id, tag, img }
export const stickers = {
  all: () => list('stickers', 'all'),
  async add(s) { const a = await list('stickers', 'all'); const x = { id: uid(), ...s }; a.push(x); await save('stickers', 'all', a); return x; },
  // desc：看過圖寫下的一句描述，他收到貼圖、自己挑貼圖時都看這句
  async update(id, patch) { const a = await list('stickers', 'all'); const x = a.find((y) => y.id === id); if (!x) return; Object.assign(x, patch); await save('stickers', 'all', a); },
  async remove(id) { await save('stickers', 'all', (await list('stickers', 'all')).filter((x) => x.id !== id)); },
  // only：只給這張角色卡用（存角色卡的 charKey）；沒有 only 的是所有角色共用
  async setOnly(id, charKey) { const a = await list('stickers', 'all'); const x = a.find((y) => y.id === id); if (!x) return; if (charKey) x.only = charKey; else delete x.only; await save('stickers', 'all', a); },
  /** 這張角色卡用得到的：共用的＋只給他的 */
  async for(charKey) { return (await list('stickers', 'all')).filter((x) => !x.only || x.only === charKey); },
};

// 故事裡現在是哪一天（劇情的 <phone> 每次會報一行「劇情日期」），劇情那本行事曆的「今天」
export const storyDay = {
  get: async (key) => (await store.get(`storyday:${key}`).catch(() => null)) || '',
  set: (key, d) => store.set(`storyday:${key}`, d).catch(() => {}),
};
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// 他現在在哪、那裡的天氣：劇情的 <phone> 每次報一行，尋找和天氣 App、鎖定畫面讀這個
// where：{ place, line, day, ts }；weather：{ city, sky, temp, day, ts }
const one = (kind) => ({
  get: async (key) => (await store.get(`${kind}:${key}`).catch(() => null)) || null,
  async set(key, v) { await store.set(`${kind}:${key}`, v).catch(() => {}); for (const f of listeners) f(kind, key); },
});
export const where = one('where');
export const weather = one('weather');

// 包裹（他叫的外送、寄的東西）：{ id, item, note, ts, eta, opened }。eta 之前是配送中
export const parcels = {
  all: (key) => list('parcels', key),
  async add(key, p) {
    const a = await list('parcels', key);
    if (a.some((x) => x.item === p.item && Math.abs(x.ts - Date.now()) < 36e5)) return null; // 重新生成同一段劇情不重複寄
    const x = { id: uid(), ts: Date.now(), opened: false, ...p }; a.unshift(x);
    await save('parcels', key, a.slice(0, 40));
    return x;
  },
  async update(key, id, patch) { const a = await list('parcels', key); const x = a.find((y) => y.id === id); if (x) Object.assign(x, patch); await save('parcels', key, a); },
  async remove(key, id) { await save('parcels', key, (await list('parcels', key)).filter((x) => x.id !== id)); },
};
