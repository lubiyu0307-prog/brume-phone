// 她貼的連結：請酒館伺服器幫忙打開網頁（酒館內建、網路搜尋擴充也在用的 /api/search/visit），
// 拿標題、摘要、內文節錄給他看。瀏覽器自己去抓多半會被跨網域擋掉，所以借伺服器的手。
// YouTube 另外走 /api/search/transcript，拿得到字幕就連字幕一起給他。

import { ctx } from './st.js';

export const URL_RE = /https?:\/\/[^\s<>"'「」『』（）()，。！？]+/gi;
export const findUrls = (text) => [...new Set(String(text || '').match(URL_RE) || [])].slice(0, 2);

const ytId = (u) => {
  try {
    const x = new URL(u);
    if (x.hostname === 'youtu.be') return x.pathname.slice(1).split('/')[0] || null;
    if (/(^|\.)youtube\.com$/.test(x.hostname)) return x.searchParams.get('v') || (x.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/) || [])[1] || null;
  } catch { /* 不是網址 */ }
  return null;
};

async function post(path, body, ms = 15000) {
  const c = ctx();
  if (!c?.getRequestHeaders) throw new Error('不在酒館裡');
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(path, { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) throw new Error(`打不開（${r.status}）`);
    return r;
  } finally { clearTimeout(t); }
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function parse(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (k) => doc.querySelector(`meta[property="${k}"],meta[name="${k}"]`)?.getAttribute('content') || '';
  let img = meta('og:image') || meta('twitter:image');
  try { if (img) img = new URL(img, url).href; } catch { img = ''; }
  doc.querySelectorAll('script,style,noscript,svg,nav,header,footer,aside,form,iframe').forEach((n) => n.remove());
  const main = doc.querySelector('article') || doc.querySelector('main') || doc.body;
  return {
    title: clean(meta('og:title') || doc.title).slice(0, 120),
    desc: clean(meta('og:description') || meta('description')).slice(0, 300),
    img,
    text: clean(main?.textContent).slice(0, 2500),
  };
}

/** 讀一個連結。讀不到也回傳東西（fail: true），讓他知道自己打不開，不要假裝看過 */
export async function readLink(url) {
  let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* 留空 */ }
  const base = { url, host };
  try {
    const id = ytId(url);
    if (id) {
      const r = await post('/api/search/transcript', { id, json: true });
      const j = await r.json().catch(() => ({}));
      const p = j.html ? parse(j.html, url) : {};
      return { ...base, ...p, kind: 'video', text: clean(j.transcript).slice(0, 2500) || p.desc || '' };
    }
    const r = await post('/api/search/visit', { url, html: true });
    const p = parse(await r.text(), url);
    if (!p.title && !p.desc && !p.text) return { ...base, fail: true };
    return { ...base, ...p };
  } catch {
    return { ...base, fail: true };
  }
}

/** 給模型看的那一段 */
export function linkForPrompt(l) {
  if (!l) return '';
  if (l.fail) return `［她分享了一個連結：${l.url}——你打不開，只看得到網址。不要假裝看過內容，可以老實說打不開、問她是什麼］`;
  return [
    `［她分享了一個${l.kind === 'video' ? ' YouTube 影片' : '連結'}（${l.host}）`,
    l.title ? `標題：${l.title}` : '',
    l.desc ? `簡介：${l.desc}` : '',
    l.text ? `${l.kind === 'video' ? '字幕' : '內容'}節錄：${l.text}` : '',
    '你已經點開看過了，照你自己的看法回她］',
  ].filter(Boolean).join('\n');
}
