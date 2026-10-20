// 儲存（Discord 版）：全部放在推播站上這支手機的 kv（/dc/api/<phone>/kv），一個鍵一份 { v, t }。
// 打開時整份抓下來放記憶體，之後每 5 秒問一次「有沒有比上次新的」，格在 Discord 那邊改了就長出來
// （發 bp-store-late 事件讓畫面重畫）。照片（dataURL）不放進 kv：先上傳成檔案，kv 裡只留網址。

const AUTH = 'wuyu:auth'; // { phone, token }
export const BASE = location.pathname.replace(/\/dc\/.*$/, '/dc');
const cache = new Map();
let resolveReady; const readyP = new Promise((r) => { resolveReady = r; });
let ready = false; let since = 0; let polling = null; let failed = 0;
const own = new Map();

export const auth = {
  get() { try { return JSON.parse(localStorage.getItem(AUTH) || 'null'); } catch { return null; } },
  set(v) { try { if (v) localStorage.setItem(AUTH, JSON.stringify(v)); else localStorage.removeItem(AUTH); } catch { /* 存不了 */ } },
};
export const api = (p) => `${BASE}/api/${auth.get()?.phone}/${p}`;
export const headers = () => ({ Authorization: `Bearer ${auth.get()?.token || ''}` });

/** 通行碼長這樣：phone.token */
export function parsePass(s) {
  const m = /^\s*([a-z0-9_-]{2,24})[.:：]([A-Za-z0-9_-]{16,})\s*$/i.exec(String(s || ''));
  return m ? { phone: m[1].toLowerCase(), token: m[2] } : null;
}

/** 驗通行碼、抓第一份資料。回 true 表示連上了 */
export async function connect(pass) {
  if (pass) auth.set(pass);
  if (!auth.get()) return false;
  try {
    const r = await fetch(api('kv'), { headers: headers(), cache: 'no-store' });
    if (!r.ok) { if (r.status === 401 || r.status === 404) auth.set(null); return false; }
    const j = await r.json();
    for (const [k, rec] of Object.entries(j.kv || {})) cache.set(k, rec);
    since = j.now || Date.now();
    if (!ready) { ready = true; resolveReady(); }
    startPolling();
    return true;
  } catch { return false; }
}
function startPolling() {
  if (polling) return;
  polling = setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const r = await fetch(api(`kv?since=${since}`), { headers: headers(), cache: 'no-store' });
      if (!r.ok) { failed++; return; }
      failed = 0;
      const j = await r.json();
      const changed = [];
      for (const [k, rec] of Object.entries(j.kv || {})) {
        const prev = cache.get(k);
        if (prev && prev.t >= rec.t) continue;
        cache.set(k, rec);
        if (own.get(k) !== rec.t) changed.push(k);
      }
      since = j.now || since;
      for (const k of changed) window.dispatchEvent(new CustomEvent('bp-store-late', { detail: k }));
    } catch { failed++; }
  }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
}

export const online = () => ready;
export const whenReady = () => readyP;
export function refresh() { since = Math.max(0, since - 1); }

export async function get(key) {
  await readyP;
  const rec = cache.get(key);
  return rec ? rec.v : null;
}

const isData = (s) => typeof s === 'string' && s.length > 1500 && s.startsWith('data:image/');
async function offload(val) {
  const seen = new Map();
  const walk = async (x) => {
    if (isData(x)) {
      if (seen.has(x)) return seen.get(x);
      const u = await putImage(x); if (u) { seen.set(x, u); return u; }
      return x;
    }
    if (Array.isArray(x)) { const out = []; for (const i of x) out.push(await walk(i)); return out; }
    if (x && typeof x === 'object') { const out = {}; for (const [k, v] of Object.entries(x)) out[k] = await walk(v); return out; }
    return x;
  };
  return walk(val);
}

export async function set(key, val) {
  await readyP;
  const t = Date.now();
  const v = await offload(val);
  cache.set(key, { v, t }); own.set(key, t);
  const r = await fetch(api(`kv/${encodeURIComponent(key)}`), { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ v, t }) });
  if (!r.ok) { window.dispatchEvent(new CustomEvent('bp-hint', { detail: r.status === 413 ? '這份資料太大存不進去' : '存不進去，等一下再試' })); throw new Error(`kv ${r.status}`); }
}
export async function del(key) { await set(key, null); }

/** dataURL → 存成檔案，回網址（存不了回空字串） */
export async function putImage(dataUrl) {
  if (!isData(dataUrl)) return '';
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const r = await fetch(api('img'), { method: 'POST', headers: { ...headers(), 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
    if (!r.ok) return '';
    return BASE.replace(/\/dc$/, '') + (await r.json()).url;
  } catch { return ''; }
}
export async function dropAsset(url) {
  const m = /\/dc\/i\/[a-z0-9_-]+\/([a-f0-9]{32})\.\w+/.exec(String(url || ''));
  if (!m) return;
  try { await fetch(api(`img/${m[1]}`), { method: 'DELETE', headers: headers() }); } catch { /* 刪不掉就留著 */ }
}

export function shrink(file, max, q = 0.82, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL(type, q));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
