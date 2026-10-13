// 讓他活起來：劇情接手機、他先傳、手機響。
//
// 一、劇情 → 手機：正文生成時多帶一段說明，請模型在「這段劇情之後他很自然會傳訊息／發文」時，
//     在回覆最後附 <phone>…</phone>。顯示前拿掉，過幾分鐘送進 LINE 或脆。不用另外叫模型。
// 二、他先傳：她離開一陣子再回來，補上這段時間他傳的；酒館開著但一陣子沒說話，他會自己找她。
// 三、手機響：網頁上方滑下一條通知，小手機按鈕跟 App 有紅點。

import { ctx, currentChar } from './st.js';
import * as stage from './stage.js';
import * as store from './store.js';

const SET_KEY = 'brume-phone:life';
const DEFAULTS = { bridge: true, level: 'high' };
export const settings = {
  get() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; } catch { return { ...DEFAULTS }; } },
  set(patch) { try { localStorage.setItem(SET_KEY, JSON.stringify({ ...settings.get(), ...patch })); } catch { /* 存不了就用預設 */ } },
};
export const LEVELS = {
  high: { name: '高', away: 2 * 36e5, idle: 25 * 6e4, chance: 0.6 },
  mid: { name: '中', away: 4 * 36e5, idle: 60 * 6e4, chance: 0.4 },
  low: { name: '低', away: 8 * 36e5, idle: 150 * 6e4, chance: 0.25 },
};

const TAG = /<phone>([\s\S]*?)<\/phone>/i;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function createLife({ line, say, onNotify, onStageHint }) {
  let pending = [];
  store.get('pending').then((p) => { pending = Array.isArray(p) ? p : []; }).catch(() => {});
  const savePending = () => store.set('pending', pending).catch(() => {});

  // ---------- 一、劇情 → 手機 ----------
  async function bridgePrompt() {
    const c = ctx(); const ch = currentChar();
    if (!c?.setExtensionPrompt) return;
    if (!ch || !settings.get().bridge) { c.setExtensionPrompt('brume-phone-bridge', '', 1, 0); return; }
    const cur = await stage.get(ch.key);
    c.setExtensionPrompt('brume-phone-bridge', [
      `[手機] ${ch.user} 和 ${ch.name} 平常也會用手機聯絡（LINE、脆）。兩人現在的關係：${stage.name(cur)}。`,
      `只有在這段劇情之後，${ch.name} 很自然會傳訊息給她、或發一篇貼文的時候（剛分開、約好下次、突然想起她、當面沒說出口的話），才在整段回覆的最後加上：`,
      '<phone>',
      'LINE｜他之後傳給她的訊息（一行一則，可以好幾行）',
      '脆｜他發的貼文（沒有就不寫這行）',
      '</phone>',
      '如果這段劇情裡兩人的關係明顯往前一步（告白成功、開始交往、搬去一起住、結婚），在 <phone> 裡加一行：關係｜新的關係（曖昧、交往、同居、結婚其中一個）。',
      '大部分回覆都不需要加。正文裡不要提到這個區塊。',
    ].join('\n'), 1, 0);
  }

  const handled = new Set();
  function takeTag(id) {
    const c = ctx(); const m = c?.chat?.[id];
    if (!m || m.is_user) return null;
    const hit = String(m.mes || '').match(TAG);
    if (!hit) return null;
    m.mes = m.mes.replace(TAG, '').trim();
    const sw = m.swipe_id ?? 0;
    if (Array.isArray(m.swipes) && m.swipes[sw] != null) m.swipes[sw] = m.mes;
    try { c.updateMessageBlock?.(id, m); } catch { /* 還沒畫出來的話，畫的時候就是乾淨的 */ }
    try { c.saveChat?.(); } catch { /* 酒館自己也會存 */ }
    const sig = `${c.getCurrentChatId?.() || ''}:${id}:${sw}:${hit[1].length}`;
    if (handled.has(sig)) return null;
    handled.add(sig);
    return hit[1];
  }

  async function onReceived(id) {
    const body = takeTag(id);
    const ch = currentChar();
    if (!body || !ch) return;
    const lines = []; const posts = []; let rel = null; let mode = 'LINE';
    for (const raw of body.split('\n')) {
      const l = raw.trim(); if (!l) continue;
      const m = l.match(/^(LINE|脆|Threads|關係)\s*[｜|:：]\s*(.*)$/i);
      if (m) { mode = m[1].toUpperCase() === 'THREADS' ? '脆' : m[1]; if (!m[2]) continue; }
      const text = m ? m[2].trim() : l;
      if (mode === '關係') rel = stage.fromWord(text);
      else if (mode === '脆') posts.push(text);
      else lines.push(text.replace(/^[「『"]+|[」』"]+$/g, ''));
    }
    const now = Date.now();
    // 不是一說完就傳：過幾分鐘手機才響
    if (lines.length) pending.push({ id: uid(), key: ch.key, type: 'line', lines: lines.slice(0, 4), at: now + (2 + Math.random() * 3) * 60000 });
    if (posts.length) pending.push({ id: uid(), key: ch.key, type: 'post', posts: posts.slice(0, 2), at: now + (6 + Math.random() * 10) * 60000 });
    savePending();
    if (rel && !stage.atLeast(await stage.get(ch.key), rel)) onStageHint?.(ch.key, rel);
  }

  async function addPost(key, name, text) {
    const f = (await store.get('threads:' + key).catch(() => null)) || { posts: [] };
    const handle = f.posts.find((p) => p.author.kind === 'char')?.author.handle || name;
    f.posts.push({ id: uid(), author: { kind: 'char', name, handle }, text, ts: Date.now(), likes: Math.floor(Math.random() * 40), replies: null, fresh: true });
    await store.set('threads:' + key, f).catch(() => {});
  }

  async function deliverDue() {
    const ch = currentChar();
    if (!ch || !pending.length) return;
    const now = Date.now();
    const due = pending.filter((p) => p.at <= now && p.key === ch.key);
    if (!due.length) return;
    pending = pending.filter((p) => !due.includes(p));
    savePending();
    for (const p of due) {
      if (p.type === 'line') { await line.deliver(p.lines); onNotify?.({ app: 'line', who: ch.name, text: p.lines[p.lines.length - 1] }); }
      if (p.type === 'post') { for (const t of p.posts) await addPost(ch.key, ch.name, t); onNotify?.({ app: 'threads', who: ch.name, text: `發了一篇串文：${p.posts[0]}` }); }
    }
  }

  // ---------- 二、他先傳 ----------
  // 正文最後一則的時間（送出或生成完成），讀不到就當很久以前
  function storyActive() {
    const chat = ctx()?.chat || [];
    for (let i = chat.length - 1; i >= 0; i--) {
      const m = chat[i]; if (!m || m.is_system) continue;
      const t = Date.parse(m.gen_finished || m.send_date || '');
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }
  const lastKey = (k) => `brume-phone:lastfirst:${k}`;
  const getLast = (k) => { try { return +localStorage.getItem(lastKey(k)) || 0; } catch { return 0; } };
  const setLast = (k) => { try { localStorage.setItem(lastKey(k), String(Date.now())); } catch { /* 無痕模式 */ } };
  let running = false;

  async function maybeFirst(reason) {
    if (running) return;
    const ch = currentChar();
    if (!ch) return;
    const cur = await stage.get(ch.key);
    if (!stage.unlocked(cur, 'proactive')) return;
    const L = LEVELS[settings.get().level] || LEVELS.high;
    const now = Date.now();
    const last = await line.lastActive();
    const gap = last ? Math.min(now - last, 24 * 36e5) : 3 * 36e5; // 從沒聊過就當三小時
    if (now - getLast(ch.key) < Math.min(L.away, L.idle)) return; // 剛剛才傳過
    if (line.busy || await line.unansweredRun() >= 2) return; // 她還沒回，不要一直刷
    if (now - storyActive() < L.idle) return; // 正文最近還在動：她在故事裡跟他相處，他不會拿手機傳
    let kind = null;
    if (reason === 'open' && gap >= L.away) kind = 'away';
    else if (reason === 'tick' && gap >= L.idle && Math.random() < L.chance) kind = gap >= L.away ? 'away' : 'idle';
    if (!kind) return;
    running = true; setLast(ch.key);
    try {
      const n = await line.himFirst(kind, gap);
      if (n) {
        const last = (await line.unseen()).pop();
        onNotify?.({ app: 'line', who: ch.name, text: last?.text || '傳了訊息給妳', count: n });
      }
    } finally { running = false; }
  }

  // ---------- 啟動 ----------
  const c = ctx();
  const ev = c?.eventTypes || c?.event_types || {};
  c?.eventSource?.on?.(ev.MESSAGE_RECEIVED || 'message_received', (id) => onReceived(id));
  c?.eventSource?.on?.(ev.CHARACTER_MESSAGE_RENDERED || 'character_message_rendered', (id) => onReceived(id)); // 串流時第一個事件可能還拿不到完整內容，再看一次
  c?.eventSource?.on?.(ev.CHAT_CHANGED || 'chat_id_changed', () => { bridgePrompt(); setTimeout(() => maybeFirst('open'), 3000); });
  bridgePrompt();
  setInterval(() => { deliverDue(); if (document.visibilityState === 'visible') maybeFirst('tick'); }, 30000);
  setTimeout(() => { deliverDue(); maybeFirst('open'); }, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { deliverDue(); maybeFirst('open'); } });

  return {
    onPhoneOpen() { deliverDue(); maybeFirst('open'); },
    refreshPrompt: bridgePrompt,
  };
}
