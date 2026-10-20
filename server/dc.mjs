// 霧語 · Discord 版的站（2026-10-20）：腦子在 Discord 的小手機，住在推播站同一台。
// 一支手機一個資料夾：/data/_wuyu-dc/<phone>/ 裡面 kv.json（所有鍵）、img/（照片）。
// 頁面本身在 repo 的 dc/ 資料夾，這裡當靜態檔案送出去。
//
// 路由（全部在 /dc 底下）：
//   GET  /dc/                      手機頁面（dc/index.html）；/dc/<檔名> 其他檔案
//   GET  /dc/i/<phone>/<id>.jpg    照片（網址猜不到，不另外驗）
//   POST /dc/api/register          { phone, token }：第一次來的 phone 記下 token 的雜湊，之後同一支一定要同一把
//   GET  /dc/api/<phone>/kv        全部的鍵 { key: { v, t } }；帶 ?since=<t> 只給比它新的
//   GET  /dc/api/<phone>/kv/<key>  一個鍵
//   PUT  /dc/api/<phone>/kv/<key>  body { v, t }
//   DELETE /dc/api/<phone>/kv/<key>
//   POST /dc/api/<phone>/img       body 是圖片本體（Content-Type image/jpeg|png|webp|gif），回 { url, id }
//   POST /dc/api/<phone>/ask       { system, prompt, image? }：請這支手機的「腦子」寫字。腦子是 kv 的 brain { url, key, model }
//                                  （格的酒館橋，OpenAI 相容的 /v1/chat/completions，走 Railway 內網），這裡只代轉
//   DELETE /dc/api/<phone>/img/<id>
// 驗證：Authorization: Bearer <token>，或 ?t=<token>。
//
// 一次性貼金鑰（給侯愷 bot 用，金鑰不經過 Discord）：
//   POST /dc/keydrop/new            { nonce, claimHash }：bot 先登記一個五分鐘的空格子
//   GET  /dc/key/<nonce>            玩家開的那一頁：一格、貼了按送出
//   POST /dc/keydrop/<nonce>        { key }：那一頁送進來，只收一次
//   GET  /dc/keydrop/<nonce>?claim= bot 來拿：claim 對得上才給，給完就刪。全部只在記憶體，五分鐘自己消失

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = () => path.join(globalThis.DATA_ROOT || '/data', '_wuyu-dc');
const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dc');
const MAX_PHONES = Number(process.env.WUYU_MAX_PHONES) || 50;
const PHONES = () => path.join(ROOT(), '_phones.json');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const readJSON = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJSON = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); const tmp = `${p}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(v)); fs.renameSync(tmp, p); };

let phones = null;
const loadPhones = () => (phones ||= readJSON(PHONES(), {}));
const okPhone = (p) => /^[a-z0-9_-]{2,24}$/.test(p);
const okKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 200;

// 一支手機的 kv 全在記憶體，改了就整份寫回（幾百 KB，夠用）
const kvs = new Map(); // phone → { map, dirty }
function kvOf(phone) {
  if (!kvs.has(phone)) kvs.set(phone, { map: readJSON(path.join(ROOT(), phone, 'kv.json'), {}), timer: null });
  return kvs.get(phone);
}
function flush(phone) {
  const k = kvs.get(phone); if (!k) return;
  clearTimeout(k.timer);
  k.timer = setTimeout(() => { try { writeJSON(path.join(ROOT(), phone, 'kv.json'), k.map); } catch (e) { console.error('[dc] kv write', e); } }, 300);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const IMG = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// ---------- 一次性金鑰格子 ----------
const drops = new Map(); // nonce → { claimHash, key, exp }
const DROP_TTL = 5 * 60e3;
setInterval(() => { const now = Date.now(); for (const [k, v] of drops) if (v.exp < now) drops.delete(k); }, 30e3).unref();
const okNonce = (n) => /^[A-Za-z0-9_-]{16,64}$/.test(n);
const KEY_PAGE = (ok) => `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>貼金鑰</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#687484,#cec5b8);font-family:-apple-system,"PingFang TC","Noto Sans TC",sans-serif;color:#fff}main{width:min(360px,92vw);text-align:center}h1{font-weight:400;font-size:28px;margin:0 0 6px}p{font-size:14px;opacity:.9;line-height:1.6;margin:0 0 14px}input{width:100%;box-sizing:border-box;height:46px;border:0;border-radius:12px;padding:0 14px;font-size:16px;background:rgba(255,255,255,.92);color:#333}button{margin-top:10px;width:100%;height:46px;border:0;border-radius:12px;font-size:16px;font-weight:600;background:#2b2824;color:#fff}small{display:block;margin-top:14px;font-size:12px;opacity:.8}</style></head><body><main>
${ok ? `<h1>貼給侯愷</h1><p>把你的 Google 金鑰（AI Studio 或 Vertex 的）貼在這裡。這一頁只收一次，送出後五分鐘內沒送也會失效，金鑰不會經過 Discord。</p>
<form id="f"><input id="k" placeholder="AIza… 或 AQ.…" autocomplete="off" autocapitalize="none" spellcheck="false"><button>送出</button></form><small id="s"></small>
<script>document.getElementById('f').onsubmit=async(e)=>{e.preventDefault();const k=document.getElementById('k').value.trim();if(k.length<20){s.textContent='這不像金鑰';return;}const r=await fetch(location.pathname.replace('/dc/key/','/dc/keydrop/'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k})});s.textContent=r.ok?'收到了，回 Discord 看他有沒有說通了。這一頁可以關掉。':'這個連結已經失效，回 Discord 再打一次 !金鑰。';if(r.ok){document.getElementById('f').hidden=true;}}</script>`
: `<h1>連結失效了</h1><p>這個連結已經用過，或超過五分鐘。回 Discord 跟他打一次 !金鑰 拿新的。</p>`}
</main></body></html>`;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' };

async function readBody(req, max) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error('too large'), { code: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}

function auth(req, u, phone) {
  const h = String(req.headers.authorization || '');
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : String(u.searchParams.get('t') || '');
  const rec = loadPhones()[phone];
  if (!rec || !tok) return false;
  const a = Buffer.from(rec.hash); const b = Buffer.from(sha(tok));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 回 true 表示這個請求是 /dc 的、已經處理掉了 */
export async function handle(req, res, u) {
  if (!(u.pathname === '/dc' || u.pathname.startsWith('/dc/'))) return false;
  const send = (code, obj, headers = {}) => { res.writeHead(code, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(obj)); return true; };
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return true; }
    if (u.pathname === '/dc') { res.writeHead(302, { Location: '/dc/' }); res.end(); return true; }

    // 一次性金鑰格子
    if (u.pathname === '/dc/keydrop/new' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 2048)).toString() || '{}');
      if (!okNonce(String(body.nonce || '')) || !/^[a-f0-9]{64}$/.test(String(body.claimHash || ''))) return send(400, { error: 'bad' });
      if (drops.size > 500) return send(429, { error: 'too many' });
      drops.set(body.nonce, { claimHash: body.claimHash, key: '', exp: Date.now() + DROP_TTL });
      return send(200, { ok: true, exp: DROP_TTL });
    }
    let m = /^\/dc\/key\/([A-Za-z0-9_-]{16,64})$/.exec(u.pathname);
    if (m && req.method === 'GET') { const d = drops.get(m[1]); const ok = !!d && d.exp > Date.now() && !d.key; res.writeHead(ok ? 200 : 410, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(KEY_PAGE(ok)); return true; }
    m = /^\/dc\/keydrop\/([A-Za-z0-9_-]{16,64})$/.exec(u.pathname);
    if (m) {
      const d = drops.get(m[1]);
      if (!d || d.exp < Date.now()) return send(410, { error: 'gone' });
      if (req.method === 'POST') {
        if (d.key) return send(410, { error: 'used' });
        const body = JSON.parse((await readBody(req, 4096)).toString() || '{}');
        const k = String(body.key || '').trim(); if (k.length < 20 || /\s/.test(k)) return send(400, { error: 'bad key' });
        d.key = k; d.exp = Date.now() + DROP_TTL; return send(200, { ok: true });
      }
      if (req.method === 'GET') {
        const claim = String(u.searchParams.get('claim') || '');
        if (!claim || sha(claim) !== d.claimHash) return send(401, { error: 'bad claim' });
        if (!d.key) return send(200, { pending: true });
        drops.delete(m[1]); return send(200, { key: d.key });
      }
      return send(405, { error: 'method' });
    }

    // 照片
    m = /^\/dc\/i\/([a-z0-9_-]+)\/([a-f0-9]{32})\.(jpg|png|webp|gif)$/.exec(u.pathname);
    if (m) {
      const p = path.join(ROOT(), m[1], 'img', `${m[2]}.${m[3]}`);
      if (!fs.existsSync(p)) return send(404, { error: 'not found' });
      res.writeHead(200, { ...CORS, 'Content-Type': MIME[`.${m[3]}`], 'Cache-Control': 'public, max-age=31536000, immutable' });
      fs.createReadStream(p).pipe(res); return true;
    }

    // API
    if (u.pathname === '/dc/api/register' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 4096)).toString() || '{}');
      const phone = String(body.phone || '').toLowerCase(); const token = String(body.token || '');
      if (!okPhone(phone) || token.length < 16) return send(400, { error: 'phone 要 2–24 個小寫英數，token 至少 16 個字' });
      const all = loadPhones();
      if (all[phone]) return auth(req, new URL(`http://x/?t=${encodeURIComponent(token)}`), phone) ? send(200, { ok: true, phone, existed: true }) : send(409, { error: "這支手機已經有通行碼了" });
      if (Object.keys(all).length >= MAX_PHONES) return send(429, { error: '手機太多了' });
      all[phone] = { hash: sha(token), at: Date.now() }; writeJSON(PHONES(), all);
      fs.mkdirSync(path.join(ROOT(), phone, 'img'), { recursive: true });
      return send(200, { ok: true, phone });
    }
    m = /^\/dc\/api\/([a-z0-9_-]+)\/(kv|img|ask)(?:\/(.+))?$/.exec(u.pathname);
    if (m) {
      const phone = m[1]; const what = m[2]; const rest = m[3] ? decodeURIComponent(m[3]) : '';
      if (!loadPhones()[phone]) return send(404, { error: 'no such phone' });
      if (!auth(req, u, phone)) return send(401, { error: 'bad token' });
      const kv = kvOf(phone);
      if (what === 'kv') {
        if (req.method === 'GET' && !rest) {
          const since = Number(u.searchParams.get('since') || 0);
          const out = {}; for (const [k, r] of Object.entries(kv.map)) if (!since || (r.t || 0) > since) out[k] = r;
          return send(200, { now: Date.now(), kv: out });
        }
        if (!okKey(rest)) return send(400, { error: 'bad key' });
        if (req.method === 'GET') return send(200, kv.map[rest] || { v: null, t: 0 });
        if (req.method === 'PUT') {
          const body = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString() || '{}');
          const rec = { v: body.v === undefined ? null : body.v, t: Number(body.t) || Date.now() };
          kv.map[rest] = rec; flush(phone);
          return send(200, { ok: true, t: rec.t });
        }
        if (req.method === 'DELETE') { delete kv.map[rest]; flush(phone); return send(200, { ok: true }); }
        return send(405, { error: 'method' });
      }
      if (what === 'ask') {
        if (req.method !== 'POST') return send(405, { error: 'method' });
        const brain = kv.map.brain?.v;
        if (!brain?.url) return send(503, { error: '這支手機還沒接腦子（kv 的 brain）' });
        const body = JSON.parse((await readBody(req, 12 * 1024 * 1024)).toString() || '{}');
        const prompt = String(body.prompt || ''); if (!prompt) return send(400, { error: 'no prompt' });
        const content = body.image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: String(body.image) } }] : prompt;
        const messages = [...(body.system ? [{ role: 'system', content: String(body.system) }] : []), { role: 'user', content }];
        const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 320e3);
        try {
          const r = await fetch(String(brain.url).replace(/\/$/, '') + '/v1/chat/completions', {
            method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(brain.key ? { Authorization: `Bearer ${brain.key}` } : {}) },
            body: JSON.stringify({ model: brain.model || 'ge', messages, stream: false, max_tokens: 3000 }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return send(502, { error: `腦子回 ${r.status}`, detail: String(j?.error?.message || j?.error || '').slice(0, 200) });
          const text = String(j?.choices?.[0]?.message?.content || '').trim();
          return send(200, { text });
        } catch (e) { return send(e?.name === 'AbortError' ? 504 : 502, { error: e?.name === 'AbortError' ? '腦子太久沒回' : `連不到腦子（${e?.message || e}）` }); }
        finally { clearTimeout(timer); }
      }
      // img
      if (req.method === 'POST' && !rest) {
        const type = String(req.headers['content-type'] || '').split(';')[0].trim();
        const ext = IMG[type]; if (!ext) return send(415, { error: '只收 jpeg、png、webp、gif' });
        const buf = await readBody(req, 12 * 1024 * 1024);
        const id = crypto.randomBytes(16).toString('hex');
        const dir = path.join(ROOT(), phone, 'img'); fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${id}.${ext}`), buf);
        return send(200, { ok: true, id, url: `/dc/i/${phone}/${id}.${ext}`, size: buf.length });
      }
      if (req.method === 'DELETE' && /^[a-f0-9]{32}(\.\w+)?$/.test(rest)) {
        const id = rest.split('.')[0]; const dir = path.join(ROOT(), phone, 'img');
        for (const ext of Object.values(IMG)) { const p = path.join(dir, `${id}.${ext}`); if (fs.existsSync(p)) fs.unlinkSync(p); }
        return send(200, { ok: true });
      }
      return send(405, { error: 'method' });
    }

    // 靜態檔案：dc/ 資料夾
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'method' });
    let rel = u.pathname.slice('/dc/'.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(SITE, rel));
    if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, { error: 'not found' });
    const ext = path.extname(file).toLowerCase();
    const cache = /\.(png|jpg|jpeg|webp|gif|ico|woff2?)$/.test(ext) ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file).pipe(res); return true;
  } catch (e) {
    if (e?.code === 413) return send(413, { error: 'too large' });
    console.error('[dc]', e);
    if (!res.headersSent) return send(500, { error: 'server error' });
    return true;
  }
}
