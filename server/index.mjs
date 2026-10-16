// 霧語 Brume Phone · 推播伺服器外掛
// 酒館關著、手機鎖著也收得到他傳的 LINE：小手機開著的時候先把接下來要傳的訊息寫好、排好時間交給這裡，
// 時間到了這裡把它標成「送出」，並推播到玩家允許過通知的每一台裝置。下次打開小手機時，送出的訊息會收進 LINE。
// 這裡不叫模型、不碰 API 金鑰，只負責「到點送出＋推播」，所以不會偷偷花錢。
//
// 安裝：整個 brume-phone 放進酒館的 plugins/ 資料夾（package.json 的 main 指到這個檔），
// 再把 enableServerPlugins 打開（或環境變數 SILLYTAVERN_ENABLESERVERPLUGINS=true）。詳細看 PUSH.md。

import fs from 'node:fs';
import path from 'node:path';
import { makeVapid, sendPush } from './webpush.mjs';

export const info = {
  id: 'brume-phone',
  name: '霧語 Brume Phone Push',
  description: '霧語小手機的推播：到點送出預先寫好的訊息，推到玩家的手機。',
};

const VERSION = 1;
const SUBJECT = 'https://github.com/lubiyu0307-prog/brume-phone';
const dir = () => path.join(globalThis.DATA_ROOT || './data', '_brume-phone');
const fileOf = (handle) => path.join(dir(), `${String(handle).replace(/[^\w.-]/g, '_')}.json`);

let vapid = null;
const users = new Map(); // handle → { subs: [], queue: { chat: [item] } }
let timer = null;

function readJSON(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function writeJSON(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v)); }

function user(handle) {
  if (!users.has(handle)) {
    const u = readJSON(fileOf(handle), {});
    users.set(handle, { subs: Array.isArray(u.subs) ? u.subs : [], queue: u.queue && typeof u.queue === 'object' ? u.queue : {} });
  }
  return users.get(handle);
}
const save = (handle) => writeJSON(fileOf(handle), user(handle));
const who = (req) => req.user?.profile?.handle || 'default-user';

// 一則排好的訊息：{ id, at, title, body, lines:[{text, st}], status:'pending'|'sent', sentAt }
const cleanItem = (x) => ({
  id: String(x.id || '').slice(0, 40),
  at: Number(x.at) || 0,
  title: String(x.title || '').slice(0, 60),
  body: String(x.body || '').slice(0, 300),
  lines: (Array.isArray(x.lines) ? x.lines : []).slice(0, 5).map((l) => ({ text: String(l?.text || '').slice(0, 500), st: String(l?.st || '').slice(0, 5) })),
  status: 'pending',
});

async function pushAll(handle, payload) {
  const u = user(handle);
  const results = [];
  for (const sub of [...u.subs]) {
    try {
      const r = await sendPush(sub, payload, vapid, { subject: SUBJECT });
      results.push(r.status);
      if (r.gone) u.subs = u.subs.filter((s) => s.endpoint !== sub.endpoint); // 這台把通知關了或換了瀏覽器
    } catch (e) { results.push(`err ${e.message || e}`); }
  }
  save(handle);
  return results;
}

// 每 20 秒看一次：時間到的訊息標成送出並推播
async function tick() {
  const now = Date.now();
  let handles = [];
  try { handles = fs.readdirSync(dir()).filter((f) => f.endsWith('.json') && f !== 'vapid.json').map((f) => f.slice(0, -5)); } catch { return; }
  for (const handle of handles) {
    const u = user(handle);
    let changed = false;
    for (const [chat, items] of Object.entries(u.queue)) {
      for (const it of items) {
        if (it.status !== 'pending' || it.at > now) continue;
        it.status = 'sent'; it.sentAt = now; changed = true;
        // 太久以前就該送的（伺服器關機那段）不推了，免得一開機連響好幾則；打開小手機時一樣會收進 LINE
        if (now - it.at < 30 * 60000 && u.subs.length) {
          await pushAll(handle, { title: it.title, body: it.body, tag: `bp-${chat}`, chat, id: it.id, url: '/' });
        }
      }
      // 送出超過七天還沒被收走的就丟掉
      u.queue[chat] = items.filter((it) => !(it.status === 'sent' && now - it.sentAt > 7 * 864e5));
    }
    if (changed) save(handle);
  }
}

export async function init(router) {
  const vp = path.join(dir(), 'vapid.json');
  vapid = readJSON(vp, null);
  if (!vapid?.publicKey) { vapid = makeVapid(); writeJSON(vp, vapid); }

  // 小手機用這個判斷「伺服器那邊裝好了沒」
  router.get('/status', (req, res) => {
    const u = user(who(req));
    res.json({ ok: true, version: VERSION, publicKey: vapid.publicKey, subs: u.subs.length });
  });

  router.post('/subscribe', (req, res) => {
    const sub = req.body?.sub;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({ error: 'bad subscription' });
    const handle = who(req); const u = user(handle);
    u.subs = u.subs.filter((s) => s.endpoint !== sub.endpoint);
    u.subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, label: String(req.body.label || '').slice(0, 60), at: Date.now() });
    u.subs = u.subs.slice(-10);
    save(handle);
    res.json({ ok: true, subs: u.subs.length });
  });

  router.post('/unsubscribe', (req, res) => {
    const handle = who(req); const u = user(handle);
    u.subs = u.subs.filter((s) => s.endpoint !== req.body?.endpoint);
    save(handle);
    res.json({ ok: true, subs: u.subs.length });
  });

  // 測試通知：馬上推一則到這個人的每一台裝置
  router.post('/test', async (req, res) => {
    const handle = who(req);
    const results = await pushAll(handle, { title: String(req.body?.title || '霧語'), body: String(req.body?.body || '通知打開了'), tag: 'bp-test', url: '/' });
    res.json({ ok: results.some((s) => s === 201 || s === 200), results });
  });

  // 這個聊天排好的、已經送出還沒收走的
  router.get('/queue', (req, res) => {
    const u = user(who(req));
    res.json({ items: u.queue[String(req.query.chat || '')] || [] });
  });

  // 換掉這個聊天還沒送的（已經送出的留著等收走）
  router.post('/queue', (req, res) => {
    const chat = String(req.body?.chat || ''); if (!chat) return res.status(400).json({ error: 'no chat' });
    const handle = who(req); const u = user(handle);
    const sent = (u.queue[chat] || []).filter((it) => it.status === 'sent');
    const fresh = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 6).map(cleanItem).filter((it) => it.id && it.at && it.lines.length);
    u.queue[chat] = [...sent, ...fresh];
    save(handle);
    res.json({ ok: true, pending: fresh.length });
  });

  // 她回話了、劇情動了：還沒送的作廢
  router.post('/cancel', (req, res) => {
    const chat = String(req.body?.chat || '');
    const handle = who(req); const u = user(handle);
    if (u.queue[chat]) u.queue[chat] = u.queue[chat].filter((it) => it.status === 'sent');
    save(handle);
    res.json({ ok: true });
  });

  // 送出的已經收進 LINE 了
  router.post('/ack', (req, res) => {
    const chat = String(req.body?.chat || ''); const ids = new Set((req.body?.ids || []).map(String));
    const handle = who(req); const u = user(handle);
    if (u.queue[chat]) u.queue[chat] = u.queue[chat].filter((it) => !(it.status === 'sent' && ids.has(it.id)));
    save(handle);
    res.json({ ok: true });
  });

  timer = setInterval(() => { tick().catch((e) => console.error('[brume-phone] tick', e)); }, 20000);
  console.log('[brume-phone] 霧語推播外掛啟動');
}

export async function exit() { clearInterval(timer); }

export default { info, init, exit };
