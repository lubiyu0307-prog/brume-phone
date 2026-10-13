// 儲存：每台裝置先存在自己的瀏覽器（IndexedDB，打開快），再同步一份到酒館伺服器的「使用者檔案」，
// 手機和電腦開同一個酒館就會看到同一支手機。兩邊都改過的話，以最後改的那邊為準。
// 'local:' 開頭的鍵只存在這台裝置，不同步（例如待送的通知，不然兩台會各送一次）。

const DB = 'brume-phone';
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function idbGet(key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(key, val) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 存進來的東西包成 { __bp: 1, v, t }，t 是最後修改時間；舊格式（沒包的）當作 t = 0
const wrap = (v, t) => ({ __bp: 1, v, t });
const unwrap = (x) => (x && x.__bp === 1 ? x : { __bp: 1, v: x, t: x === undefined ? 0 : 1 }); // 舊格式有值的當 t = 1，伺服器上沒有時才會傳上去

// ---------- 伺服器同步 ----------
const st = () => window.SillyTavern?.getContext?.();
const canSync = (key) => !String(key).startsWith('local:') && !!st()?.getRequestHeaders;

// 酒館的檔名只能用英數、底線、橫線、點，所以把鍵算成雜湊當檔名
function fileName(key) {
  let h1 = 0x811c9dc5; let h2 = 0x01000193;
  for (const ch of String(key)) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return `brume-phone-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}.json`;
}
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const remoteCache = new Map(); // key → { at, p }，同一個鍵 15 秒內只問伺服器一次
async function remoteGet(key) {
  const hit = remoteCache.get(key);
  if (hit && Date.now() - hit.at < 15000) return hit.p;
  const p = (async () => {
    try {
      const r = await fetch(`/user/files/${fileName(key)}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.__bp === 1 ? j : null;
    } catch { return null; }
  })();
  remoteCache.set(key, { at: Date.now(), p });
  return p;
}

const uploads = new Map();
function remotePut(key, rec) {
  remoteCache.set(key, { at: Date.now(), p: Promise.resolve(rec) });
  clearTimeout(uploads.get(key));
  // 連續改很多次只傳最後一次
  uploads.set(key, setTimeout(async () => {
    uploads.delete(key);
    try {
      await fetch('/api/files/upload', {
        method: 'POST', headers: st().getRequestHeaders(),
        body: JSON.stringify({ name: fileName(key), data: toBase64(JSON.stringify(rec)) }),
      });
    } catch { /* 沒網路就先存在這台，下次改的時候會再傳 */ }
  }, 800));
}

/** 下次 get 一律重問伺服器（打開手機、切回這個分頁時用） */
export function refresh() { remoteCache.clear(); }

export async function get(key) {
  const local = unwrap(await idbGet(key));
  if (!canSync(key)) return local.v;
  const remote = await Promise.race([remoteGet(key), new Promise((r) => setTimeout(() => r(null), 2500))]);
  if (remote && remote.t > local.t) { await idbPut(key, remote); return remote.v; }
  // 伺服器上沒有、或比較舊（例如這台離線時改過），把這台的傳上去
  if (local.t && (!remote || remote.t < local.t)) remotePut(key, local);
  return local.v;
}

export async function set(key, val) {
  const rec = wrap(val, Date.now());
  await idbPut(key, rec);
  if (canSync(key)) remotePut(key, rec);
}

export async function del(key) {
  // 刪除也要讓別台知道，所以存一個空值、時間是現在
  await set(key, null);
}

/** 圖片縮到長邊 max 再轉成 dataURL（預設 JPEG；貼圖要留透明背景就傳 image/png） */
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
