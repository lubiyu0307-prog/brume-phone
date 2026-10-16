// 推播外掛的離線測試：node server/test-push.mjs（不用開酒館）
// 假的推播服務收訊息，用自己寫的解密核對；測排程送出、作廢、備用短訊。
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

globalThis.DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-push-'));
const plugin = await import('./index.mjs');

const got = [];
const fake = http.createServer((req, res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => { got.push(Buffer.concat(c)); res.writeHead(201); res.end(); }); });
await new Promise((r) => fake.listen(0, r));
const port = fake.address().port;

const routes = {};
const router = { get: (p, f) => { routes['GET ' + p] = f; }, post: (p, f) => { routes['POST ' + p] = f; } };
await plugin.init(router);
const call = (m, p, { body = {}, query = {} } = {}) => new Promise((resolve) => {
  routes[`${m} ${p}`]({ user: { profile: { handle: 'tester' } }, body, query }, { json: resolve, status: () => ({ json: resolve }) });
});

// 收到的推播用 RFC 8291 解回來
const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
function decrypt(buf) {
  const salt = buf.subarray(0, 16); const idlen = buf[20]; const asPub = buf.subarray(21, 21 + idlen); const body = buf.subarray(21 + idlen);
  const shared = ua.computeSecret(asPub);
  const h = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const ikm = h(h(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])]));
  const prk = h(salt, ikm);
  const cek = h(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = h(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(body.subarray(-16));
  const out = Buffer.concat([d.update(body.subarray(0, -16)), d.final()]);
  return JSON.parse(out.subarray(0, out.lastIndexOf(2)).toString());
}

let fails = 0;
const ok = (cond, name) => { console.log(cond ? '✓' : '✗', name); if (!cond) fails++; };

await call('POST', '/subscribe', { body: { sub: { endpoint: `http://127.0.0.1:${port}/p`, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } } });
const t = await call('POST', '/test', { body: { title: '霧語', body: '測試' } });
ok(t.ok && decrypt(got[0]).body === '測試', '測試通知送得到、解得開');

const now = Date.now();
await call('POST', '/queue', { body: { chat: 'c1', title: '阿愷', cfg: { tz: 480, quietFrom: 1, quietTo: 9 }, fallback: ['在幹嘛', '記得喝水'], items: [
  { id: 'a', at: now - 1000, title: '阿愷', body: '下班了嗎', lines: [{ text: '下班了嗎' }] },
  { id: 'b', at: now + 3600e3, title: '阿愷', body: '晚安', lines: [{ text: '晚安' }] },
] } });
await plugin._internal.tick();
let q = await call('GET', '/queue', { query: { chat: 'c1' } });
ok(q.items.find((i) => i.id === 'a')?.status === 'sent' && q.items.find((i) => i.id === 'b')?.status === 'pending', '到點的送出、還沒到的留著');
ok(decrypt(got[1]).body === '下班了嗎', '到點的推播內容對');
ok(q.fallbackLeft === 2, '備用短訊收到兩句');

await call('POST', '/cancel', { body: { chat: 'c1' } });
q = await call('GET', '/queue', { query: { chat: 'c1' } });
ok(!q.items.some((i) => i.status === 'pending'), '作廢後沒有待送的');

// 假裝她 21 小時沒碰：備用短訊（避開安靜時段才送）
const u = plugin._internal.users.get('tester');
u.meta.c1.touched = now - 21 * 3600e3; u.queue.c1.forEach((i) => { i.sentAt = now - 21 * 3600e3; });
const before = got.length;
await plugin._internal.tick();
const h = new Date(Date.now() + 480 * 60000).getUTCHours();
const quiet = h >= 1 && h < 9;
q = await call('GET', '/queue', { query: { chat: 'c1' } });
if (quiet) ok(got.length === before, `台灣 ${h} 點是安靜時段，備用短訊不送`);
else ok(got.length === before + 1 && q.fallbackLeft === 1 && q.items.some((i) => i.id.startsWith('fb')), '一整天沒開：送一句備用短訊，也留著等收進 LINE');
await plugin._internal.tick();
ok(got.length === (quiet ? before : before + 1), '同一天不會再送第二句');

await call('POST', '/ack', { body: { chat: 'c1', ids: q.items.map((i) => i.id) } });
q = await call('GET', '/queue', { query: { chat: 'c1' } });
ok(q.items.length === 0, '收進 LINE 之後清掉');

await plugin.exit(); fake.close();
console.log(fails ? `${fails} 項沒過` : '全部通過');
process.exit(fails ? 1 : 0);
