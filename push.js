// 推播：酒館關著也收得到他傳的 LINE。
// 玩家什麼都不用裝：所有霧語共用比比架的「霧語推播站」（server/relay.mjs），跟以前 brume 的推播一樣按一下就好。
// 這裡負責「開啟通知」那顆按鈕、先把接下來要傳的訊息寫好交給推播站排時間，以及把已經送出的訊息收進 LINE。
// 送去推播站的只有：推播訂閱、角色名、預先寫好的幾則訊息、排定時間、安靜時段；聊天的代號先雜湊過。

import { ctx, phoneOff } from './st.js';

// 霧語推播站的網址（比比的 Railway）。擴充設定裡填了 relay 就用那個（自己架的人用）
const DEFAULT_RELAY = 'https://wuyu-push-production.up.railway.app';
const relay = () => String(ctx()?.extensionSettings?.['brume-phone']?.relay || DEFAULT_RELAY).replace(/\/+$/, '');
const BASE = new URL('.', import.meta.url);
const FLAG = 'brume-phone:push-device'; // 這台裝置按過「開啟通知」

// 這個酒館在推播站的身分：第一次用時自己產生，存在擴充設定（手機電腦同一份，所以兩邊都收得到）
function identity() {
  const c = ctx(); const root = (c?.extensionSettings ? (c.extensionSettings['brume-phone'] ||= {}) : {});
  if (!/^[a-f0-9]{32}$/.test(root.pushId || '') || !/^[a-f0-9]{64}$/.test(root.pushKey || '')) {
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
    root.pushId = hex(16); root.pushKey = hex(32);
    c?.saveSettingsDebounced?.();
  }
  return { id: root.pushId, key: root.pushKey };
}
// 聊天代號（裡面有角色名）先雜湊再送出去
function chatId(key) {
  let h1 = 0x811c9dc5; let h2 = 0x01000193;
  for (const ch of String(key)) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
async function call(path, body) {
  const base = relay(); if (!base) throw new Error('no relay');
  const { id, key } = identity();
  const headers = { 'Content-Type': 'application/json', 'X-BP-Id': id, 'X-BP-Key': key };
  const r = await fetch(base + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

let statusCache = null; let statusAt = 0;
/** 推播站連不連得上：連得上回 { publicKey, subs }，連不上回 null */
export async function serverStatus(force = false) {
  if (!force && statusCache !== undefined && Date.now() - statusAt < 60000) return statusCache;
  try { statusCache = await call('/status'); } catch { statusCache = null; }
  statusAt = Date.now();
  return statusCache;
}

/** 推播相關的設定，存在酒館的擴充設定（手機電腦同一份） */
export const pushSet = {
  get() {
    const s = ctx()?.extensionSettings?.['brume-phone']?.push || {};
    // mode：story＝照劇情裡的時間寫；real＝照現實送到的時間寫（早上收到早安那種）
    return { on: !!s.on, mode: s.mode === 'real' ? 'real' : 'story', max: [1, 2, 3, 5].includes(+s.max) ? +s.max : 3, quietFrom: Number.isFinite(+s.quietFrom) ? +s.quietFrom : 1, quietTo: Number.isFinite(+s.quietTo) ? +s.quietTo : 9 };
  },
  set(patch) {
    const c = ctx(); if (!c?.extensionSettings) return;
    const root = (c.extensionSettings['brume-phone'] ||= {});
    root.push = { ...pushSet.get(), ...patch };
    c.saveSettingsDebounced?.();
  },
};

export function platform() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const standalone = !!navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  return { ios, android, desktop: !ios && !android, standalone };
}
export const deviceOn = () => { try { return localStorage.getItem(FLAG) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted'; } catch { return false; } };

/**
 * 按「開啟通知」前先檢查一遍：回傳 { ready, why }。why 是給玩家看的下一步（ready 為 false 時）。
 * 要在按下去之前就先檢查好：iPhone 只讓「按下去的那一刻」跳出允許通知的視窗，等伺服器回話就來不及了
 */
export async function precheck() {
  const p = platform();
  if (!window.isSecureContext) return { ready: false, why: '酒館的網址要是 https 開頭才收得到通知。雲端的酒館（Railway、Zeabur）本來就是 https；裝在家裡電腦、用 http 開的收不到。' };
  if (!('serviceWorker' in navigator)) return { ready: false, why: '這個瀏覽器不支援通知。iPhone 請用 Safari，安卓請用 Chrome。' };
  if (p.ios && !p.standalone) return { ready: false, why: 'iPhone 要先把酒館加到主畫面：Safari 下面的分享按鈕 →「加入主畫面」，再從主畫面的圖示打開酒館，回來這裡按一次。' };
  if (!('PushManager' in window)) return { ready: false, why: p.ios ? 'iPhone 要 iOS 16.4 以上才收得到網頁通知，先更新系統。' : '這個瀏覽器不支援推播通知，換 Chrome 試試。' };
  const st = await serverStatus(true);
  if (!st) return { ready: false, why: relay() ? '霧語推播站暫時連不上，過一下再試。' : '這個版本的霧語還沒設定推播站，等更新。' };
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return { ready: false, why: p.ios ? '通知被關掉了：到 iPhone 的「設定 → 通知」找到酒館，打開「允許通知」。' : '通知被瀏覽器擋了：點網址列左邊的圖示 → 網站設定 → 通知改成允許。' };
  return { ready: true, status: st };
}

const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

async function registration() {
  const reg = await navigator.serviceWorker.register(new URL('sw.js', BASE).href, { scope: BASE.pathname });
  // 範圍只有擴充資料夾，navigator.serviceWorker.ready 不會等到它，自己等它啟動
  const w = reg.installing || reg.waiting;
  if (w && !reg.active) await new Promise((res) => { w.addEventListener('statechange', () => { if (w.state === 'activated') res(); }); setTimeout(res, 8000); });
  return reg;
}

/** 按下「開啟通知」：一定要直接在按鈕的點擊裡呼叫，第一個 await 就是請求權限 */
export async function enable(status) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, why: '沒有允許通知。想打開的話再按一次，跳出來的視窗選「允許」。' };
  const reg = await registration();
  const key = keyBytes(status.publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const old = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (!old || old.length !== key.length || old.some((b, i) => b !== key[i])) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const p = platform();
  await call('/subscribe', { sub: sub.toJSON(), label: p.ios ? 'iPhone' : p.android ? 'Android' : 'Desktop' });
  try { localStorage.setItem(FLAG, '1'); } catch { /* 無痕模式 */ }
  pushSet.set({ on: true });
  const t = await call('/test', { title: '霧語', body: '通知打開了，他傳訊息的時候會跳在這裡。' }).catch(() => null);
  return { ok: true, tested: !!t?.ok };
}

/**
 * 每次打開酒館順手檢查一次（brume B108 的教訓）：伺服器換過鑰匙、或 iPhone 自己把訂閱清掉，
 * 推播會整個靜音而且看不出來。鑰匙不對或訂閱不見就重訂，再跟伺服器報到一次
 */
export async function syncIfEnabled() {
  if (!deviceOn() || !('serviceWorker' in navigator)) return;
  const st = await serverStatus(true);
  if (!st?.publicKey) return;
  try {
    const reg = (await navigator.serviceWorker.getRegistration(BASE.pathname)) || (await registration());
    const key = keyBytes(st.publicKey);
    let sub = await reg.pushManager.getSubscription();
    const old = sub?.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    if (sub && (!old || old.length !== key.length || old.some((b, i) => b !== key[i]))) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const p = platform();
    await call('/subscribe', { sub: sub.toJSON(), label: p.ios ? 'iPhone' : p.android ? 'Android' : 'Desktop' });
  } catch { /* 下次打開再試 */ }
}

export async function disable() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(BASE.pathname);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await call('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* 已經沒了 */ }
  try { localStorage.removeItem(FLAG); } catch { /* 無痕模式 */ }
  const st = await serverStatus(true);
  if (!st?.subs) pushSet.set({ on: false }); // 每台都關了才停止在背景寫訊息
}

// ---------- 背景傳訊息 ----------
const cfg = () => { const s = pushSet.get(); return { tz: -new Date().getTimezoneOffset(), quietFrom: s.quietFrom, quietTo: s.quietTo, real: s.mode === 'real' }; };
export const queue = {
  info: (chat) => call(`/queue?chat=${chatId(chat)}`),
  get: (chat) => queue.info(chat).then((r) => r.items || []),
  // extra：{ title, fallback }——角色名、備用短訊（排好的用完、她又很久沒開時，推播站從這裡挑一句推）
  put: (chat, items, extra = {}) => call('/queue', { chat: chatId(chat), items, cfg: cfg(), ...extra }),
  cancel: (chat) => call('/cancel', { chat: chatId(chat), cfg: cfg() }).catch(() => {}),
  ack: (chat, ids) => call('/ack', { chat: chatId(chat), ids }).catch(() => {}),
};

/** 這張卡現在要不要在背景排訊息 */
export async function bgActive(ch) {
  if (!ch || phoneOff.is(ch.charKey) || !pushSet.get().on) return false;
  return !!(await serverStatus());
}

/**
 * 挑下一則的送出時間：from 之後隔 gap（毫秒，隨機 0.8～1.6 倍），落在安靜時段就延到安靜時段結束後一小時內；
 * 那天已經排滿就排到隔天
 */
export function nextSlot(from, gap, dayCount) {
  const { max, quietFrom, quietTo } = pushSet.get();
  let at = from + gap * (0.8 + Math.random() * 0.8);
  const inQuiet = (d) => { const h = d.getHours() + d.getMinutes() / 60; return quietFrom < quietTo ? h >= quietFrom && h < quietTo : h >= quietFrom || h < quietTo; };
  const wake = (d) => { const w = new Date(d); w.setHours(quietTo, 0, 0, 0); if (w <= d) w.setDate(w.getDate() + 1); return w.getTime() + Math.random() * 3600e3; };
  if (inQuiet(new Date(at))) at = wake(new Date(at));
  if (dayCount(at) >= max) { const d = new Date(at); d.setDate(d.getDate() + 1); d.setHours(quietTo, 0, 0, 0); at = d.getTime() + Math.random() * 3 * 3600e3; }
  return Math.round(at);
}

// 點通知打開酒館時：網址帶 bp-open=line，或酒館本來就開著、小幫手傳話過來
export function onOpenRequest(fn) {
  try {
    const u = new URL(location.href);
    if (u.searchParams.get('bp-open')) { u.searchParams.delete('bp-open'); history.replaceState(null, '', u.href); setTimeout(() => fn('line'), 2500); }
  } catch { /* 網址讀不到就算了 */ }
  navigator.serviceWorker?.addEventListener?.('message', (e) => { if (e.data?.type === 'bp-open') fn(e.data.app || 'line'); });
}
