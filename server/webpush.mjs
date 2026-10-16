// Web Push 送信（RFC 8291 加密 + RFC 8292 VAPID），只用 node:crypto，不用另外裝套件。
// 酒館的伺服器外掛沒辦法 npm install，所以自己寫；測試拿 http_ece 解密對過（server/test-webpush.mjs）。

import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/** 產生一組 VAPID 金鑰（P-256）。publicKey 是給瀏覽器的 65 位元組未壓縮格式 */
export function makeVapid() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

function vapidKeyObject({ publicKey, privateKey }) {
  const pub = fromB64u(publicKey);
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: b64u(fromB64u(privateKey)), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
}

/** VAPID 的 Authorization 標頭（ES256 JWT，12 小時有效） */
export function vapidHeader(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: vapidKeyObject(vapid), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.publicKey}`;
}

/**
 * 把內容加密成 aes128gcm（RFC 8291）。sub 是瀏覽器給的 subscription（keys.p256dh、keys.auth）。
 * opts.asPrivate / opts.salt 只給測試固定用
 */
export function encrypt(payload, sub, opts = {}) {
  const uaPublic = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = opts.salt || crypto.randomBytes(16);

  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);

  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([2])]); // 0x02＝最後一段，不補白
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/**
 * 送一則推播。回傳 { ok, status, gone }：gone＝這個訂閱失效了（404／410），該刪掉
 */
export async function sendPush(sub, payload, vapid, { subject, ttl = 24 * 3600, urgency = 'high' } = {}) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(sub.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
    },
    body: encrypt(typeof payload === 'string' ? payload : JSON.stringify(payload), sub),
  });
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
