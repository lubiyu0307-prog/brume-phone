// 霧語推播站：比比架一台，所有玩家的霧語按「開啟通知」就連到這裡，酒館不用裝任何東西。
// 只收：推播訂閱、角色名、霧語預先寫好的幾則訊息和備用短訊、排定時間、安靜時段。
// 不收：API 金鑰、聊天內容、角色卡、世界書。聊天的代號在玩家那邊先雜湊過。
//
// 部署：node server/relay.mjs（package.json 的 start 就是這個）。
// 環境變數：PORT（平台給）、BP_DATA（存資料的資料夾，要掛永久磁碟，預設 /data）。
// 身分：每個霧語第一次連線時自己產生一組 id＋key，這裡只存 key 的雜湊；之後同一個 id 一定要同一把 key。

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.BP_DATA || '/data';
globalThis.DATA_ROOT = DATA;
const core = await import('./index.mjs');

const MAX_IDS = Number(process.env.BP_MAX_IDS) || 5000; // 防止被亂註冊塞爆
const AUTH_FILE = path.join(DATA, '_brume-phone', '_auth.json');
let auth = {};
try { auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')); } catch { auth = {}; }
const saveAuth = () => { fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true }); fs.writeFileSync(AUTH_FILE, JSON.stringify(auth)); };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function identify(req) {
  const id = String(req.headers['x-bp-id'] || ''); const key = String(req.headers['x-bp-key'] || '');
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{64}$/.test(key)) return null;
  const h = sha(key);
  if (auth[id]) return crypto.timingSafeEqual(Buffer.from(auth[id]), Buffer.from(h)) ? id : null;
  if (Object.keys(auth).length >= MAX_IDS) return null;
  auth[id] = h; saveAuth(); // 第一次來的：記下這把 key
  return id;
}

// 同一個 IP 十分鐘最多 300 次
const hits = new Map();
function limited(ip) {
  const now = Date.now(); const h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 600e3) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  return h.n > 300;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 600e3) hits.delete(k); }, 600e3).unref();

// 把核心的路由收集起來（核心原本是寫給酒館外掛的 express router）
const routes = new Map();
await core.init({ get: (p, f) => routes.set(`GET ${p}`, f), post: (p, f) => routes.set(`POST ${p}`, f) });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-BP-Id, X-BP-Key',
  'Access-Control-Max-Age': '86400',
};

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' || u.pathname === '/health') return send(200, { ok: true, name: '霧語推播站' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (limited(ip)) return send(429, { error: 'too many requests' });
    const f = routes.get(`${req.method} ${u.pathname}`);
    if (!f) return send(404, { error: 'not found' });
    const id = identify(req);
    if (!id && u.pathname !== '/status') return send(401, { error: 'bad id' });
    let body = {};
    if (req.method === 'POST') {
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 64 * 1024) return send(413, { error: 'too large' }); chunks.push(c); }
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return send(400, { error: 'bad json' }); }
    }
    const fake = { user: { profile: { handle: id || '_anon' } }, body, query: Object.fromEntries(u.searchParams) };
    let code = 200;
    await f(fake, { status: (c) => { code = c; return { json: (o) => send(code, o) }; }, json: (o) => send(code, o) });
  } catch (e) {
    console.error('[relay]', e);
    if (!res.headersSent) send(500, { error: 'server error' });
  }
});

const port = Number(process.env.PORT) || 8787;
server.listen(port, () => console.log(`霧語推播站 listening on ${port}，資料在 ${DATA}`));
const stop = async () => { await core.exit(); server.close(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);

export { server };
