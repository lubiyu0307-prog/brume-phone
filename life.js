// 讓他活起來：劇情接手機、他先傳、手機響。
//
// 一、劇情 → 手機：正文生成時多帶一段說明，請模型在「這段劇情之後他很自然會傳訊息／發文」時，
//     在回覆最後附 <phone>…</phone>。顯示前拿掉，過幾分鐘送進 LINE 或脆。不用另外叫模型。
// 二、他先傳：她離開一陣子再回來，補上這段時間他傳的；酒館開著但一陣子沒說話，他會自己找她。
// 三、手機響：網頁上方滑下一條通知，小手機按鈕跟 App 有紅點。

import { ctx, currentChar } from './st.js';
import * as stage from './stage.js';
import * as store from './store.js';
import * as data from './data.js';

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
// 看起來像寫作計畫、檢查清單的行不收（拍、節拍、玩家、區塊、輸出、正文、標籤）
const META = /節拍|厚拍|\d+\s*拍|玩家|區塊|輸出|正文|主詞|prompt|<|>|\{\{/i;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function createLife({ line, say, onNotify, onStageHint, onData }) {
  let pending = [];
  store.get('local:pending').then((p) => { pending = Array.isArray(p) ? p : []; }).catch(() => {});
  const savePending = () => store.set('local:pending', pending).catch(() => {});

  // ---------- 一、劇情 → 手機 ----------
  async function bridgePrompt() {
    const c = ctx(); const ch = currentChar();
    if (!c?.setExtensionPrompt) return;
    if (!ch || !settings.get().bridge) { c.setExtensionPrompt('brume-phone-bridge', '', 1, 0); return; }
    const cur = await stage.get(ch.key);
    const notesOn = stage.unlocked(cur, 'notes');
    const [ns, cs] = await Promise.all([notesOn ? data.notes.all(ch.key) : [], data.cal.all(ch.key)]);
    const have = [
      ...cs.slice(-8).map((e) => `行事曆 ${e.date} ${e.title}`),
      ...ns.filter((n) => !n.done).slice(0, 6).map((n) => `便條 ${n.text}`),
    ];
    c.setExtensionPrompt('brume-phone-bridge', [
      `[手機] ${ch.user} 和 ${ch.name} 平常也會用手機聯絡（LINE、脆），也共用一本行事曆${notesOn ? '，冰箱門上會貼便條' : ''}。兩人現在的關係：${stage.name(cur)}。`,
      `這段劇情之後，如果手機上很自然會多出什麼，就在整段回覆的最後加一個區塊（只寫用得到的行）：`,
      '<phone>',
      `LINE｜${ch.name} 之後傳給她的訊息（只有兩人分開了才寫：剛道別、各自在外面、他想用手機聯絡她；或劇情裡他真的拿手機傳了訊息。一行一則）`,
      `脆｜${ch.name} 發的貼文（他自己一個人、有空滑手機的時候才會發）`,
      `行事曆｜YYYY-MM-DD｜標題（日期是今天就省略，寫成 行事曆｜標題）`,
      notesOn ? `便條｜${ch.name} 貼在冰箱上給她的叮嚀（20 字內）` : '',
      '</phone>',
      `行事曆要勤勞記：劇情裡真的發生、值得記住的「第一次」和轉折（第一次說出口的話、第一次一起做的事）、約好的事、紀念日、回診檢查這類跟兩人生活有關的日子。標題 12 字內，像他會寫的字。`,
      notesOn ? `便條也要勤勞貼：劇情裡她的身體、作息、天氣、要吃的藥或補品、他出門前放不下心的事，他都會寫一張貼著，內容要接得上劇情。一次一兩張。` : '',
      have.length ? `手機上已經有的，不要再寫一次：\n${have.map((h) => '- ' + h).join('\n')}` : '',
      '如果這段劇情裡兩人的關係明顯往前一步（告白成功、開始交往、搬去一起住、結婚），在 <phone> 裡加一行：關係｜新的關係（曖昧、交往、同居、結婚其中一個）。',
      // 10/16 比比：兩個人還在床上，LINE 一直跳通知。人就在旁邊，不會傳訊息
      `這段劇情結束時兩人如果還在一起（同一個空間、在親熱、躺在一起、一起吃飯出門），就不寫 LINE 也不寫脆：人就在旁邊，他不會拿手機傳給她。行事曆、便條照常可以寫。`,
      '劇情裡沒發生值得記的事就不用加。正文裡不要提到這個區塊。',
    ].filter(Boolean).join('\n'), 1, 0);
  }

  const handled = new Set();
  function takeTag(id) {
    const c = ctx(); const m = c?.chat?.[id];
    if (!m || m.is_user) return null;
    // 只拿最後一個真正的區塊：模型的思考、預設的檢查清單常會先提到「<phone>」這個字，
    // 從第一次提到一路抓到結尾，會把整段計畫當成 LINE 送出去（10/15 阿愷傳了「區塊輸出⋯節拍單⋯」）
    const mes = String(m.mes || '');
    const low = mes.toLowerCase();
    const close = low.lastIndexOf('</phone>');
    // 思考區塊（<thinking>、<think>）裡的不算：從思考結束之後才開始找
    const thinkEnd = Math.max(low.lastIndexOf('</thinking>'), low.lastIndexOf('</think>'));
    const open = close < 0 ? -1 : low.lastIndexOf('<phone>', close);
    if (open < 0 || open < thinkEnd) return null;
    const hit = [null, mes.slice(open + 7, close)];
    if (hit[1].length > 1500 || /<\/?think/i.test(hit[1])) return null; // 正常的區塊只有幾行，這麼長一定是抓錯了
    m.mes = (mes.slice(0, open) + mes.slice(close + 8)).trim();
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
    const lines = []; const posts = []; const cals = []; const notes = []; let rel = null; let mode = null;
    // 看起來像寫作計畫、檢查清單的行不收（拍、節拍、玩家、區塊、輸出、正文、標籤）
    for (const raw of body.split('\n')) {
      const l = raw.trim(); if (!l) continue;
      const m = l.match(/^(LINE|脆|Threads|關係|行事曆|便條|便利貼)\s*[｜|:：]\s*(.*)$/i);
      if (m) { mode = m[1].toUpperCase() === 'THREADS' ? '脆' : m[1] === '便利貼' ? '便條' : m[1]; if (!m[2]) continue; }
      else if (!mode || mode === '關係' || l.length > 80) continue; // 開頭沒標是哪一種、或太長的，不是要放進手機的東西
      if (META.test(l)) continue;
      const text = (m ? m[2].trim() : l).replace(/^[-・*]\s*/, '');
      if (mode === '關係') rel = stage.fromWord(text);
      else if (mode === '脆') posts.push(text);
      else if (mode === '行事曆') { const ev = calLine(text); if (ev) cals.push(ev); }
      else if (mode === '便條') notes.push(text.replace(/^[「『"]+|[」』"]+$/g, '').slice(0, 40));
      else lines.push(text.replace(/^[「『"]+|[」』"]+$/g, ''));
    }
    await landData(ch, cals, notes);
    const now = Date.now();
    // 不是一說完就傳：過幾分鐘手機才響
    if (lines.length) pending.push({ id: uid(), key: ch.key, type: 'line', lines: lines.slice(0, 4), at: now + (2 + Math.random() * 3) * 60000 });
    if (posts.length) pending.push({ id: uid(), key: ch.key, type: 'post', posts: posts.slice(0, 2), at: now + (6 + Math.random() * 10) * 60000 });
    savePending();
    if (rel && !stage.atLeast(await stage.get(ch.key), rel)) onStageHint?.(ch.key, rel);
  }

  // 「行事曆｜2026-10-20｜回診」「行事曆｜10/20｜回診」「行事曆｜他第一次說想要寶寶」都收
  function calLine(text) {
    const parts = text.split(/\s*[｜|]\s*/).filter(Boolean);
    if (!parts.length) return null;
    let date = data.today(); let title = parts.join(' ');
    const full = parts[0].match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    const short = parts[0].match(/^(\d{1,2})[-/.](\d{1,2})$/);
    if ((full || short) && parts.length > 1) {
      const y = full ? +full[1] : new Date().getFullYear();
      const mo = +(full ? full[2] : short[1]); const d = +(full ? full[3] : short[2]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      title = parts.slice(1).join(' ');
    }
    title = title.replace(/^[「『"]+|[」』"]+$/g, '').trim().slice(0, 24);
    return title ? { date, title } : null;
  }

  // 行事曆和便條不用等：劇情一寫完就落地，手機響一下
  async function landData(ch, cals, notes) {
    if (!cals.length && !notes.length) return;
    const cur = await stage.get(ch.key);
    for (const e of cals.slice(0, 3)) {
      const before = (await data.cal.all(ch.key)).length;
      await data.cal.add(ch.key, { ...e, by: 'him' });
      if ((await data.cal.all(ch.key)).length > before) onNotify?.({ app: 'calendar', who: ch.name, text: `記上行事曆：${e.date.slice(5).replace('-', '/')} ${e.title}` });
    }
    if (stage.unlocked(cur, 'notes')) {
      const have = new Set((await data.notes.all(ch.key)).map((n) => n.text));
      for (const t of notes.slice(0, 3)) {
        if (!t || have.has(t)) continue;
        await data.notes.add(ch.key, { text: t, by: 'him' }); have.add(t);
        onNotify?.({ app: 'notes', who: ch.name, text: `在冰箱貼了便條：${t}` });
      }
    }
    onData?.();
    bridgePrompt(); // 已經有的換新，下次不重複
  }

  async function addPost(key, name, text) {
    const f = (await store.get('threads:' + key).catch(() => null)) || { posts: [] };
    const handle = f.posts.find((p) => p.author.kind === 'char')?.author.handle || name;
    f.posts.push({ id: uid(), author: { kind: 'char', name, handle }, text, ts: Date.now(), likes: Math.floor(Math.random() * 40), replies: null, fresh: true });
    await store.set('threads:' + key, f).catch(() => {});
  }

  // 送出前再擋一次：舊版排進佇列的、或漏網的寫作計畫，不讓它變成他傳的訊息
  const clean = (t) => { t = String(t || '').trim(); return t && t.length <= 200 && !META.test(t) ? t : ''; };

  async function deliverDue() {
    const ch = currentChar();
    if (!ch || !pending.length) return;
    const now = Date.now();
    const due = pending.filter((p) => p.at <= now && p.key === ch.key);
    if (!due.length) return;
    pending = pending.filter((p) => !due.includes(p));
    savePending();
    for (const p of due) {
      const lines = (p.lines || []).map(clean).filter(Boolean); const posts = (p.posts || []).map(clean).filter(Boolean);
      if (p.type === 'line' && lines.length) { await line.deliver(lines); onNotify?.({ app: 'line', who: ch.name, text: lines[lines.length - 1] }); }
      if (p.type === 'post' && posts.length) { for (const t of posts) await addPost(ch.key, ch.name, t); onNotify?.({ app: 'threads', who: ch.name, text: `發了一篇串文：${posts[0]}` }); }
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
