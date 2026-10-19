// 讓他活起來：劇情接手機、他先傳、手機響。
//
// 一、劇情 → 手機：正文生成時多帶一段說明，請模型在「這段劇情之後他很自然會傳訊息／發文」時，
//     在回覆最後附 <phone>…</phone>。顯示前拿掉，過幾分鐘送進 LINE 或脆。不用另外叫模型。
// 二、他先傳：她離開一陣子再回來，補上這段時間他傳的；酒館開著但一陣子沒說話，他會自己找她。
// 三、手機響：網頁上方滑下一條通知，小手機按鈕跟 App 有紅點。

import { ctx, currentChar, phoneOff } from './st.js';
import * as stage from './stage.js';
import * as store from './store.js';
import * as data from './data.js';
import * as push from './push.js';

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
    if (!ch || !settings.get().bridge || phoneOff.is(ch.charKey)) { c.setExtensionPrompt('brume-phone-bridge', '', 1, 0); return; }
    const cur = await stage.get(ch.key);
    const notesOn = stage.unlocked(cur, 'notes');
    const [ns, cs] = await Promise.all([notesOn ? data.notes.all(ch.key) : [], data.cal.all(ch.key)]);
    const sday = await data.storyDay.get(ch.key);
    const have = [
      ...cs.filter((e) => data.calKind(e) === 'story').slice(-8).map((e) => `行事曆 ${e.date} ${e.title}`),
      ...ns.filter((n) => !n.done).slice(0, 6).map((n) => `便條 ${n.text}`),
    ];
    c.setExtensionPrompt('brume-phone-bridge', [
      `[手機] ${ch.user} 和 ${ch.name} 平常也會用手機聯絡（LINE、脆），也共用一本行事曆${notesOn ? '，冰箱門上會貼便條' : ''}。兩人現在的關係：${stage.name(cur)}。`,
      `這段劇情之後，如果手機上很自然會多出什麼，就在整段回覆的最後加一個區塊（只寫用得到的行）：`,
      '<phone>',
      `劇情日期｜YYYY-MM-DD（每次都寫這一行：故事裡現在是哪一天。故事沒交代年份就用 ${new Date().getFullYear()}${sday ? `；上次是 ${sday}，照劇情往後推` : ''}）`,
      `位置｜地點｜一句話（每次都寫：這段結束時 ${ch.name} 人在哪、在做什麼。地點 10 字內，像地圖上的名字；一句話是他當下的狀態，15 字內。兩人在一起就寫同一個地方）`,
      `天氣｜城市｜天氣｜氣溫（每次都寫：故事裡那個地方現在的天氣，例如 天氣｜台北｜小雨｜18。故事沒交代就照季節和時間合理推，跟上次差不多就照抄）`,
      `包裹｜東西｜附的小卡（只有兩人分開、他有理由的時候才寫：她生病、加班、心情不好、紀念日，他幫她叫了外送或寄了東西。東西 12 字內，小卡 30 字內像他會寫的話。很少發生，大部分回覆不寫）`,
      `LINE｜${ch.name} 之後傳給她的訊息（只有兩人分開了才寫：剛道別、各自在外面、他想用手機聯絡她；或劇情裡他真的拿手機傳了訊息。一行一則）`,
      `脆｜${ch.name} 發的貼文（他自己一個人、有空滑手機的時候才會發）`,
      `行事曆｜YYYY-MM-DD｜標題（日期用劇情裡的日子；就是劇情裡的今天就省略，寫成 行事曆｜標題）`,
      notesOn ? `便條｜${ch.name} 貼在冰箱上給她的叮嚀（20 字內）` : '',
      '</phone>',
      `行事曆要勤勞記：劇情裡真的發生、值得記住的「第一次」和轉折（第一次說出口的話、第一次一起做的事）、約好的事、紀念日、回診檢查這類跟兩人生活有關的日子。標題 12 字內，像他會寫的字。`,
      // 10/18 比比：冰箱門一整片、每則都跳出來。改成偶爾一張
      notesOn ? `便條偶爾才貼：只有他要出門、她要自己待一陣子，而且真的有放不下心的事（身體、要吃的藥、天氣）才寫，內容要接得上劇情。一次最多一張，大部分回覆都不寫。` : '',
      have.length ? `手機上已經有的，不要再寫一次（同一件事換個說法也算重複）：\n${have.map((h) => '- ' + h).join('\n')}` : '',
      '如果這段劇情裡兩人的關係明顯往前一步（告白成功、開始交往、搬去一起住、結婚），在 <phone> 裡加一行：關係｜新的關係（曖昧、交往、同居、結婚其中一個）。',
      // 10/16 比比：兩個人還在床上，LINE 一直跳通知。人就在旁邊，不會傳訊息
      `這段劇情結束時兩人如果還在一起（同一個空間、在親熱、躺在一起、一起吃飯出門），就不寫 LINE、脆、包裹：人就在旁邊，他不會拿手機傳給她。位置、天氣、行事曆、便條照常寫。`,
      '劇情日期、位置、天氣每次都寫；其他的，劇情裡沒發生值得記的事就不用寫。正文裡不要提到這個區塊。',
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
    const lines = []; const posts = []; const cals = []; const notes = []; const parcels = []; let rel = null; let mode = null;
    let storyToday = (await data.storyDay.get(ch.key)) || data.today();
    // 看起來像寫作計畫、檢查清單的行不收（拍、節拍、玩家、區塊、輸出、正文、標籤）
    for (const raw of body.split('\n')) {
      const l = raw.trim(); if (!l) continue;
      const sd = l.match(/^劇情日期\s*[｜|:：]\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (sd) { storyToday = `${sd[1]}-${sd[2].padStart(2, '0')}-${sd[3].padStart(2, '0')}`; await data.storyDay.set(ch.key, storyToday); mode = null; continue; }
      // 位置、天氣：一行一筆，直接存（尋找、天氣 App 讀）
      const loc = l.match(/^位置\s*[｜|:：]\s*([^｜|]{1,20})(?:\s*[｜|]\s*(.{1,40}))?$/);
      if (loc) { if (!META.test(l)) await data.where.set(ch.key, { place: loc[1].trim(), line: (loc[2] || '').trim(), day: storyToday, ts: Date.now() }); mode = null; continue; }
      const wx = l.match(/^天氣\s*[｜|:：]\s*([^｜|]{1,12})\s*[｜|]\s*([^｜|]{1,10})(?:\s*[｜|]\s*(-?\d{1,2}))?/);
      if (wx) { if (!META.test(l)) await data.weather.set(ch.key, { city: wx[1].trim(), sky: wx[2].trim(), temp: wx[3] != null ? +wx[3] : null, day: storyToday, ts: Date.now() }); mode = null; continue; }
      const m = l.match(/^(LINE|脆|Threads|關係|行事曆|便條|便利貼|包裹)\s*[｜|:：]\s*(.*)$/i);
      if (m) { mode = m[1].toUpperCase() === 'THREADS' ? '脆' : m[1] === '便利貼' ? '便條' : m[1]; if (!m[2]) continue; }
      else if (!mode || mode === '關係' || l.length > 80) continue; // 開頭沒標是哪一種、或太長的，不是要放進手機的東西
      if (META.test(l)) continue;
      const text = (m ? m[2].trim() : l).replace(/^[-・*]\s*/, '');
      if (mode === '關係') rel = stage.fromWord(text);
      else if (mode === '脆') posts.push(text);
      else if (mode === '行事曆') { const ev = calLine(text, storyToday); if (ev) cals.push({ ...ev, kind: 'story' }); }
      else if (mode === '包裹') { const [item, ...rest] = text.split(/\s*[｜|]\s*/); if (item) parcels.push({ item: item.replace(/^[「『"]+|[」』"]+$/g, '').slice(0, 24), note: rest.join(' ').replace(/^[「『"]+|[」』"]+$/g, '').slice(0, 60) }); }
      else if (mode === '便條') notes.push(text.replace(/^[「『"]+|[」』"]+$/g, '').slice(0, 40));
      else lines.push(text.replace(/^[「『"]+|[」』"]+$/g, ''));
    }
    await landData(ch, cals, notes);
    const now = Date.now();
    // 不是一說完就傳：LINE 等一分鐘手機才響（原本兩到五分鐘，10/19 改短）
    if (lines.length) pending.push({ id: uid(), key: ch.key, type: 'line', lines: lines.slice(0, 4), at: now + 60000 }); // 10/19 比比：壓一分鐘就好，玩家剛好把劇情讀完
    if (posts.length) pending.push({ id: uid(), key: ch.key, type: 'post', posts: posts.slice(0, 2), at: now + (6 + Math.random() * 10) * 60000 });
    for (const p of parcels.slice(0, 1)) await shipParcel(ch, p, now);
    savePending();
    if (rel && !stage.atLeast(await stage.get(ch.key), rel)) onStageHint?.(ch.key, rel);
  }

  // 包裹：先出現在包裹 App 裡「配送中」，二三十分鐘後送達才響。正文的 <phone> 與 LINE 的 [[PARCEL]] 都走這裡
  // （10/19 比比：格那張卡劇情裡兩人都在一起，包裹永遠收不到——所以 LINE 裡他也能寄）
  async function shipParcel(ch, p, now = Date.now()) {
    const eta = now + (20 + Math.random() * 20) * 60000;
    const x = await data.parcels.add(ch.key, { ...p, eta });
    if (!x) return false;
    pending.push({ id: uid(), key: ch.key, type: 'parcel', parcel: x.id, item: x.item, at: eta });
    savePending();
    onNotify?.({ app: 'parcel', who: ch.name, text: `幫妳寄了東西，配送中` });
    return true;
  }

  // 「行事曆｜2026-10-20｜回診」「行事曆｜10/20｜回診」「行事曆｜他第一次說想要寶寶」都收
  function calLine(text, day = data.today()) {
    const parts = text.split(/\s*[｜|]\s*/).filter(Boolean);
    if (!parts.length) return null;
    let date = day; let title = parts.join(' ');
    const full = parts[0].match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    const short = parts[0].match(/^(\d{1,2})[-/.](\d{1,2})$/);
    if ((full || short) && parts.length > 1) {
      const y = full ? +full[1] : +day.slice(0, 4);
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
      const all = await data.notes.all(ch.key);
      const have = new Set(all.map((n) => n.text));
      // 一次一張，而且離他上一張至少一個半小時（模型還是每則都寫的話，程式這邊擋）
      const lastHim = Math.max(0, ...all.filter((n) => n.by === 'him').map((n) => n.ts || 0));
      for (const t of Date.now() - lastHim < 90 * 60000 ? [] : notes.slice(0, 1)) {
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
      if (p.type === 'parcel') onNotify?.({ app: 'parcel', who: ch.name, text: `妳有一份包裹送到了：${p.item}` });
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
    if (!ch || phoneOff.is(ch.charKey)) return;
    if (await push.bgActive(ch)) return; // 開了推播：改成背景排好時間送（planBg），這裡不再當場傳，免得重複
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

  // ---------- 三、背景推播：酒館關著也會傳 ----------
  // 她沒在玩的時候，先把他接下來要傳的一兩則寫好、排好時間交給伺服器；時間到了伺服器推播，下次打開再收進 LINE。
  // 她一回話或劇情一動，還沒送的就作廢，等她又離開一陣子再重寫（不然每講一句就要重寫一次，太花錢）
  let planning = false; let lastPlan = 0;
  // 最近一次排程的結果，設定頁的通知區顯示（以前沒排到也看不出來，比比 10/17 等了一整天才發現是關係階段沒設）
  let bgStatus = { at: 0, text: '' };
  const note = (text) => { bgStatus = { at: Date.now(), text }; };
  const hm = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  async function pullBg() {
    const ch = currentChar();
    if (!(await push.bgActive(ch))) return;
    try {
      const sent = (await push.queue.get(ch.key)).filter((i) => i.status === 'sent');
      if (!sent.length) return;
      await line.deliverBg(sent);
      await push.queue.ack(ch.key, sent.map((i) => i.id));
    } catch { /* 伺服器沒回就下次再收 */ }
  }
  async function planBg({ leaving = false } = {}) {
    if (planning || line.busy) return;
    const ch = currentChar();
    if (!(await push.bgActive(ch))) return;
    const L = LEVELS[settings.get().level] || LEVELS.high;
    const now = Date.now();
    const last = Math.max(await line.lastActive(), storyActive());
    // 她停下來一分鐘就先排（以前等三分鐘；她講完就切走的話 iPhone 只給幾秒，走酒館橋的卡一則要一分鐘，永遠排不到）
    if (!leaving && now - last < 60000) return;
    if (now - lastPlan < 10 * 60000) return;
    const cur = await stage.get(ch.key);
    if (!stage.unlocked(cur, 'proactive')) { note(`關係階段還在「${stage.name(cur)}」，要到「${stage.needFor('proactive')}」以上他才會主動傳。`); return; }
    planning = true; lastPlan = now;
    try {
      const info = await push.queue.info(ch.key); const items = info.items || [];
      if (items.some((i) => i.status === 'sent')) { await pullBg(); }
      const waiting = items.filter((i) => i.status === 'pending');
      if (waiting.length) { note(`下一則排在 ${hm(Math.min(...waiting.map((i) => i.at)))}。`); return; }
      note('正在寫他接下來要傳的訊息⋯');
      const counts = await line.bgCounts();
      const real = push.pushSet.get().mode === 'real';
      const plan = []; const pending = []; let prev = Math.max(now, last);
      const put = (extra = {}) => (currentChar()?.key === ch.key && lastPlan === now ? (push.rememberChat(ch), push.queue.put(ch.key, plan, { title: ch.name, ...extra })) : null);
      for (let k = 0; k < 2; k++) {
        const at = push.nextSlot(prev, L.away, (t) => { const d = new Date(t).toDateString(); return (counts[d] || 0) + plan.filter((p) => new Date(p.at).toDateString() === d).length; });
        // 照劇情時混用：劇情裡兩人在一起寫不出來，就改照現實寫（那幾行帶 now）
        const lines = await line.compose('away', { pending, real, at, mix: true });
        if (!lines.length) break;
        const isReal = real || lines.some((l) => l.now);
        plan.push({ id: uid(), at, title: ch.name, body: lines.map((l) => l.text).join('\n'), lines, ...(isReal ? { real: true } : {}) });
        pending.push(...lines); prev = at;
        await put(); // 寫好一則就先交出去：她中途切走、第二則沒寫完，至少第一則排到了
      }
      // 備用短訊：排好的都送完、她又一整天沒開時，伺服器從這裡挑一句（快用完或放太久才重寫）
      let fallback;
      if ((info.fallbackLeft || 0) < 2 || now - (info.fallbackAt || 0) > 5 * 864e5) fallback = (await line.compose('nudge')).map((l) => l.text);
      if (fallback?.length) await put({ fallback });
      if (plan.length) note(`下一則排在 ${hm(plan[0].at)}。`);
      else note('這次沒寫出來，等妳下次停下來再排。');
    } catch { note('這次沒排成功（連不上模型或推播站），等妳下次停下來再排。'); } finally { planning = false; }
  }
  const cancelBg = async () => { const ch = currentChar(); if (ch && await push.bgActive(ch)) { await push.queue.cancel(ch.key); lastPlan = 0; } };
  window.addEventListener('bp-line-sent', cancelBg);

  // ---------- 啟動 ----------
  const c = ctx();
  const ev = c?.eventTypes || c?.event_types || {};
  c?.eventSource?.on?.(ev.MESSAGE_RECEIVED || 'message_received', (id) => { onReceived(id); cancelBg(); });
  c?.eventSource?.on?.(ev.CHARACTER_MESSAGE_RENDERED || 'character_message_rendered', (id) => onReceived(id)); // 串流時第一個事件可能還拿不到完整內容，再看一次
  c?.eventSource?.on?.(ev.CHAT_CHANGED || 'chat_id_changed', () => { bridgePrompt(); setTimeout(() => { pullBg(); maybeFirst('open'); }, 3000); });
  bridgePrompt();
  setInterval(deliverDue, 15000); // LINE 只壓一分鐘，查勤要跟得上
  setInterval(() => { if (document.visibilityState === 'visible') { maybeFirst('tick'); planBg(); } }, 30000);
  setTimeout(() => { deliverDue(); maybeFirst('open'); }, 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { deliverDue(); pullBg(); maybeFirst('open'); }
    else planBg({ leaving: true }); // 她要離開了：趁還醒著排好（iPhone 切走後只給幾秒，排不完就等下次）
  });

  return {
    onPhoneOpen() { deliverDue(); pullBg(); maybeFirst('open'); },
    planBg, pullBg, sendParcel: (ch, p) => shipParcel(ch, p),
    bgStatus: () => bgStatus,
    refreshPrompt: bridgePrompt,
  };
}
