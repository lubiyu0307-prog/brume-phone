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

// 行事曆：{ id, date: 'YYYY-MM-DD', title, by, ts }
export const cal = {
  all: (key) => list('cal', key),
  async add(key, e) {
    const a = await list('cal', key);
    // 同一天同一件事只記一次（重新生成時不會重複落地）
    if (a.some((x) => x.date === e.date && x.title === e.title)) return;
    a.push({ id: uid(), ts: Date.now(), ...e }); a.sort((x, y) => x.date.localeCompare(y.date));
    await save('cal', key, a);
  },
  async remove(key, id) { await save('cal', key, (await list('cal', key)).filter((x) => x.id !== id)); },
};

// 記憶書：{ id, text, ts }
export const memory = {
  all: (key) => list('memory', key),
  async add(key, text) { const a = await list('memory', key); a.push({ id: uid(), ts: Date.now(), text }); await save('memory', key, a); },
  async update(key, id, text) { const a = await list('memory', key); const m = a.find((x) => x.id === id); if (m) m.text = text; await save('memory', key, a); },
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

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
