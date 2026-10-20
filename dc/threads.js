// 脆（Threads）：她的帳號在滑首頁河道。上面有他發的文、卡裡配角的文，還有符合這個世界觀與年代的路人。
// 可以按愛心、看留言、留言（發文的人會回）、自己發文（大家會來留言，他也可能出現）。

import * as store from './store.js';
import { currentChar, generate, worldRoster } from './st.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const KIND = { 本人: 'char', 配角: 'side', 路人: 'npc' };

const IC = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M16.8 8.6C16 6 14.2 4.5 11.8 4.5 8 4.5 5.5 7.6 5.5 12s2.5 7.5 6.3 7.5c3 0 5.3-1.6 5.3-4.3 0-2.4-2-3.7-4.8-3.7-2.2 0-3.6 1-3.6 2.4 0 1.3 1.1 2.2 2.6 2.2 2.4 0 3.6-1.8 3.6-5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
  heartOn: '<svg viewBox="0 0 24 24" fill="#ff3040" stroke="#ff3040" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5z"/></svg>',
  repost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7v4M6 17v-4"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4.5-4.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-5.5 7.5-5.5s6.3 1.5 7.5 5.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
};

function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return '剛剛';
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時`;
  if (s < 604800) return `${Math.floor(s / 86400)} 天`;
  const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`;
}
const fmt = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}萬` : String(n || ''));

// 名字做出固定的顏色，路人的頭像才不會每次不一樣
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

// 一行一則：類型｜名稱｜帳號｜內容｜讚數
function parseLines(raw, ch, withLikes) {
  const out = [];
  for (const l of raw.split('\n')) {
    const p = l.replace(/^\s*[-*\d.、]+\s*/, '').split(/[｜|]/).map((x) => x.trim());
    if (p.length < 4 || !p[3]) continue;
    const kind = KIND[p[0]] || 'npc';
    const name = kind === 'char' ? ch.name : p[1] || '路人';
    out.push({
      id: uid(),
      author: { kind, name, handle: (p[2] || name).replace(/^@/, '').replace(/\s+/g, '_').slice(0, 24) },
      text: p[3].replace(/\\n/g, '\n'),
      likes: withLikes ? Math.max(0, parseInt(String(p[4] || '').replace(/[^\d]/g, ''), 10) || Math.floor(Math.random() * 80)) : Math.floor(Math.random() * 12),
    });
  }
  return out;
}

const WORLD = [
  '- 路人的身分、語氣、話題都要符合現實世界、現在的台灣（2026 年），像真的脆上會看到的人',
  '- 寫得像真的脆：口語、短、有個性，可以是心情、吐槽、日常、問問題',
];

export function createThreads({ screen, say }) {
  let ch = null; let feed = null; let view = 'feed'; let openId = null; let loading = false; let backTo = 'feed';

  const key = () => 'threads:' + ch.key;
  const save = () => ch && store.set(key(), feed).catch(() => {});
  const me = () => ({ kind: 'me', name: ch.user, handle: feed.handle || ch.user });
  const find = (id) => feed.posts.find((p) => p.id === id);
  const mine = () => !!screen.querySelector('.bp-th');

  function av(a, size = '') {
    if (a.kind === 'char' && ch.avatar) return `<img class="bp-th-av ${size}" src="${ch.avatar}" alt="">`;
    return `<span class="bp-th-av ${size}" style="--h:${hue(a.handle)}">${esc((a.name || '?').slice(0, 1))}</span>`;
  }

  function post(p, opts = {}) {
    const n = p.replies?.length || 0;
    return `<article class="bp-th-post${opts.detail ? ' detail' : ''}" ${opts.detail ? '' : `data-post="${p.id}"`}>
      <div class="bp-th-left">${av(p.author)}${opts.line ? '<i class="bp-th-line"></i>' : ''}</div>
      <div class="bp-th-main">
        <div class="bp-th-top"><b>${esc(p.author.handle)}</b>${p.author.kind === 'char' ? '<em class="bp-th-badge">●</em>' : ''}<span>${ago(p.ts)}</span><i data-thmore="${p.id}">${IC.more}</i></div>
        <div class="bp-th-text">${esc(p.text)}</div>
        <div class="bp-th-acts">
          <span data-like="${p.id}" class="${p.liked ? 'on' : ''}">${p.liked ? IC.heartOn : IC.heart}${fmt(p.likes + (p.liked ? 1 : 0))}</span>
          <span data-post="${p.id}">${IC.reply}${n ? n : ''}</span>
          <span>${IC.repost}</span><span>${IC.share}</span>
        </div>
      </div></article>`;
  }

  function reply(r, pid) {
    return `<div class="bp-th-reply">
      <div class="bp-th-left">${av(r.author, 'sm')}</div>
      <div class="bp-th-main">
        <div class="bp-th-top"><b>${esc(r.author.handle)}</b>${r.author.kind === 'char' ? '<em class="bp-th-badge">●</em>' : ''}<span>${ago(r.ts)}</span></div>
        <div class="bp-th-text">${esc(r.text)}</div>
        <div class="bp-th-acts"><span data-rlike="${pid}|${r.id}" class="${r.liked ? 'on' : ''}">${r.liked ? IC.heartOn : IC.heart}${fmt(r.likes + (r.liked ? 1 : 0))}</span></div>
      </div></div>`;
  }

  function tabs(active) {
    return `<nav class="bp-th-tabs">
      <span data-th="feed" class="${active === 'feed' ? 'on' : ''}">${IC.home}</span>
      <span data-th="nope">${IC.search}</span>
      <span data-th="compose">${IC.plus}</span>
      <span data-th="nope">${IC.heart}</span>
      <span data-th="profile" class="${active === 'profile' ? 'on' : ''}">${IC.user}</span></nav>`;
  }

  async function render() {
    ch = currentChar();
    if (!ch) {
      screen.innerHTML = `<div class="bp-th"><div class="bp-th-head"><span class="bp-back" data-th="home">‹</span><i class="bp-th-logo">${IC.logo}</i><span></span></div>
        <p class="bp-th-empty">先在酒館選一個角色。</p></div>`;
      return;
    }
    feed = (await store.get(key()).catch(() => null)) || { posts: [] };
    if (view === 'post' && find(openId)) renderPost(); else if (view === 'profile') renderProfile(); else renderFeed();
    // 河道還沒有路人、配角（只有他自己或她的）就自己更新一次：格先放進來的那幾篇不算有河道（10/20 比比：路人留言要跟酒館版一樣豐富）
    if (view === 'feed' && !feed.posts.some((p) => p.author.kind === 'npc' || p.author.kind === 'side') && !loading) refresh();
  }

  function renderFeed() {
    view = 'feed';
    const posts = [...feed.posts].sort((a, b) => b.ts - a.ts);
    screen.innerHTML = `<div class="bp-th">
      <div class="bp-th-head"><span class="bp-back" data-th="home">‹</span><i class="bp-th-logo">${IC.logo}</i><i class="bp-th-ref${loading ? ' spin' : ''}" data-th="refresh">${IC.refresh}</i></div>
      <div class="bp-th-scroll">
        <div class="bp-th-compose" data-th="compose">${av(me())}<span>有什麼新鮮事？</span><b>發佈</b></div>
        ${loading ? '<div class="bp-th-loading">河道更新中⋯</div>' : ''}
        ${posts.map((p) => post(p)).join('')}
        ${!posts.length && !loading ? '<p class="bp-th-empty">河道是空的，按右上角重新整理。</p>' : ''}
      </div>${tabs('feed')}</div>`;
  }

  function renderProfile() {
    view = 'profile';
    const mineP = feed.posts.filter((p) => p.author.kind === 'me').sort((a, b) => b.ts - a.ts);
    screen.innerHTML = `<div class="bp-th">
      <div class="bp-th-head"><span class="bp-back" data-th="feed">‹</span><span></span><span></span></div>
      <div class="bp-th-scroll">
        <div class="bp-th-prof"><div><b>${esc(ch.user)}</b><span>${esc(me().handle)} <u data-th="handle">改帳號</u></span></div>${av(me(), 'lg')}</div>
        <div class="bp-th-ptab">串文</div>
        ${mineP.length ? mineP.map((p) => post(p)).join('') : '<p class="bp-th-empty">還沒有發過文。</p>'}
      </div>${tabs('profile')}</div>`;
  }

  function renderPost() {
    view = 'post';
    const p = find(openId);
    screen.innerHTML = `<div class="bp-th">
      <div class="bp-th-head"><span class="bp-back" data-th="back">‹</span><b>串文</b><span></span></div>
      <div class="bp-th-scroll">
        ${post(p, { detail: true })}
        <div class="bp-th-rhead">回覆</div>
        ${p.loadingReplies ? '<div class="bp-th-loading">留言載入中⋯</div>' : ''}
        ${(p.replies || []).map((r) => reply(r, p.id)).join('')}
        ${p.replies?.length === 0 && !p.loadingReplies ? '<p class="bp-th-empty">還沒有人回覆。</p>' : ''}
      </div>
      <form class="bp-th-bar">${av(me(), 'sm')}<input placeholder="回覆 ${esc(p.author.handle)}⋯" enterkeyhint="send"><button>發佈</button></form>
    </div>`;
  }

  function composer() {
    screen.insertAdjacentHTML('beforeend', `<div class="bp-th-sheet"><div class="bp-th-sheet-card">
      <div class="bp-th-sheet-top"><u data-th="unsheet">取消</u><b>新串文</b><span></span></div>
      <div class="bp-th-sheet-body">${av(me())}<div><b>${esc(me().handle)}</b><textarea placeholder="有什麼新鮮事？" rows="5"></textarea></div></div>
      <div class="bp-th-sheet-foot"><span>任何人都能回覆</span><button data-th="post">發佈</button></div></div></div>`);
    screen.querySelector('.bp-th-sheet textarea').focus();
  }

  function postMenu(id) {
    const p = find(id); if (!p) return;
    screen.querySelector('.bp-ig-menu')?.remove();
    screen.insertAdjacentHTML('beforeend', `<div class="bp-ig-menu"><div class="bp-ig-menu-bg" data-thm="close"></div><div class="bp-ig-menu-card">
      ${p.author.kind !== 'me' ? `<button data-thm="redo" data-id="${p.id}">重寫這則</button>` : ''}
      <button data-thm="del" data-id="${p.id}" class="danger">刪除這則</button>
      <button data-thm="close">取消</button></div></div>`);
  }

  // 寫歪的貼文重寫：發文的人照角色卡和世界書，帳號不對就換掉（同帳號的其他貼文、回覆一起換）
  async function rewritePost(p) {
    const who = ch; const f = feed;
    say('重寫中⋯');
    try {
      const raw = await generate([
        await worldRoster(),
        '[Brume Phone · 脆（Threads）]',
        `現在不是在寫劇情正文。重寫脆上的一則貼文，原本是 @${p.author.handle}（${p.author.name}）發的：${p.text}`,
        p.author.kind === 'char' ? `這則是 ${who.name} 本人發的，照他的個性和最近發生的事重寫，類型寫「本人」。` : `發文的人是誰、做什麼的、帳號叫什麼，照角色卡、世界書和正文；原本的身分或帳號跟資料不合就改掉。不要寫成 ${who.user} 發的。`,
        ...WORLD,
        '',
        '只寫一行，格式：類型｜顯示名稱｜帳號｜內容｜按讚數',
        '類型只能是「本人」「配角」「路人」。帳號用英文小寫、數字、底線或點。內容不要換行。不要其他文字。',
      ].filter(Boolean).join('\n'));
      const n = parseLines(raw, who, true)[0];
      if (!n) throw new Error('沒有寫出來');
      const old = p.author.handle;
      if (p.author.kind !== 'char' && n.author.kind !== 'char') {
        const fix = (a) => { if (a && a.kind !== 'me' && a.kind !== 'char' && a.handle === old) { a.handle = n.author.handle; a.name = n.author.name; a.kind = n.author.kind; } };
        f.posts.forEach((x) => { fix(x.author); (x.replies || []).forEach((r) => fix(r.author)); });
      }
      p.text = n.text; p.replies = null; // 內容換了，回覆重來
      if (who.key === ch?.key) save();
      say('重寫好了');
      if (mine()) view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed();
    } catch (err) { say(`沒有重寫成功：${err.message || err}`); }
  }

  // ---------- 生成 ----------
  async function refresh() {
    if (loading || !ch) return;
    loading = true; if (view === 'feed') renderFeed();
    const who = ch; const f = feed;
    try {
      const have = f.posts.slice(-12).map((p) => `${p.author.handle}：${p.text.slice(0, 30)}`).join('\n');
      const raw = await generate([
        await worldRoster(),
        '[Brume Phone · 脆（Threads）]',
        `現在不是在寫劇情正文。${who.user} 正在滑脆（Threads）的首頁河道。請寫 6 則河道上的新貼文：`,
        `- 1～2 則是 ${who.name} 本人發的：照他的個性、生活和最近發生的事`,
        '- 1～2 則是角色卡、世界書裡出現過的配角發的；沒有配角就用路人補',
        '- 其他是路人',
        ...WORLD,
        `- 不要寫 ${who.user} 本人發的文`,
        have ? `河道上已經有的（不要重複）：\n${have}` : '',
        '',
        '每則一行，格式：類型｜顯示名稱｜帳號｜內容｜按讚數',
        '類型只能是「本人」「配角」「路人」。帳號用英文小寫、數字、底線或點。內容不要換行。不要其他文字。',
      ].filter(Boolean).join('\n'));
      const fresh = parseLines(raw, who, true);
      if (!fresh.length) throw new Error('沒有生出貼文');
      // 新貼文的時間灑在過去幾個小時裡，看起來像真的河道
      fresh.forEach((p, i) => { p.ts = Date.now() - Math.floor((i + Math.random()) * 25 * 60000); p.replies = null; });
      if (who.key === ch?.key) { f.posts.push(...fresh); f.posts = f.posts.slice(-80); save(); }
    } catch (e) { say(`河道更新失敗：${e.message || e}`); }
    loading = false;
    if (mine() && view === 'feed') renderFeed();
  }

  async function loadReplies(p) {
    p.loadingReplies = true; p.replies = []; renderPost();
    const who = ch;
    try {
      const raw = await generate([
        await worldRoster(),
        '[Brume Phone · 脆（Threads）]',
        `現在不是在寫劇情正文。這是脆上的一則貼文，請寫底下的 3～5 則回覆。`,
        `貼文（${p.author.kind === 'char' ? `${who.name} 本人` : p.author.kind === 'me' ? `${who.user} 本人` : p.author.name}，@${p.author.handle}）：${p.text}`,
        p.author.kind === 'me' ? `- 這是 ${who.user} 發的文，${who.name} 一定會來回覆，用他平常對她的語氣` : `- ${who.name} 想回的話也可以出現，但不一定`,
        '- 回覆的人可以是配角或路人，發文的人也可以回自己的串',
        ...WORLD,
        `- 不要寫 ${who.user} 的回覆`,
        '',
        '每則一行，格式：類型｜顯示名稱｜帳號｜內容',
        '類型只能是「本人」「配角」「路人」（本人＝' + who.name + '）。不要其他文字。',
      ].join('\n'));
      p.replies = parseLines(raw, who, false).map((r, i) => ({ ...r, ts: Math.min(Date.now(), p.ts + (i + 1) * (3 + Math.random() * 20) * 60000) }));
    } catch (e) { p.replies = []; say(`留言載入失敗：${e.message || e}`); }
    p.loadingReplies = false; save();
    if (mine() && view === 'post' && openId === p.id) renderPost();
  }

  async function answer(p, text) {
    const who = ch;
    p.replies ||= [];
    p.replies.push({ id: uid(), author: me(), text, ts: Date.now(), likes: 0 });
    save(); renderPost();
    try {
      const ctxLines = p.replies.slice(-12).map((r) => `@${r.author.handle}：${r.text}`).join('\n');
      const target = p.author.kind === 'me' ? `${who.name}` : `發文的 @${p.author.handle}`;
      const raw = await generate([
        await worldRoster(),
        '[Brume Phone · 脆（Threads）]',
        `現在不是在寫劇情正文。${who.user}（@${me().handle}）在脆上留言了，請寫接下來的 1～2 則回覆：`,
        `- 優先是${target}回她；${p.author.kind === 'char' || p.author.kind === 'me' ? '' : `${who.name} 看到也可以插一句，`}語氣照各自的個性`,
        ...WORLD,
        '',
        `貼文（@${p.author.handle}）：${p.text}`,
        `回覆串：\n${ctxLines}`,
        '',
        '每則一行，格式：類型｜顯示名稱｜帳號｜內容（類型：本人＝' + who.name + '、配角、路人）。不要寫 ' + who.user + ' 的回覆，不要其他文字。',
      ].join('\n'));
      const rs = parseLines(raw, who, false);
      // 照原本串裡的帳號接回去，同一個人不會換帳號
      for (const r of rs) {
        const same = [p.author, ...p.replies.map((x) => x.author)].find((a) => a.kind !== 'me' && (a.name === r.author.name || (r.author.kind === 'char' && a.kind === 'char')));
        if (same) r.author = same;
        r.ts = Date.now();
        p.replies.push(r);
      }
      save();
    } catch (e) { say(`沒有人回：${e.message || e}`); }
    if (mine() && view === 'post' && openId === p.id) renderPost();
  }

  // ---------- 事件 ----------
  screen.addEventListener('click', async (e) => {
    if (!mine()) return;
    // 貼文右上角 ⋯：重寫這則、刪除這則
    const more = e.target.closest('[data-thmore]');
    if (more) { e.stopPropagation(); postMenu(more.dataset.thmore); return; }
    const mm = e.target.closest('[data-thm]');
    if (mm) {
      e.stopPropagation();
      const p = find(mm.dataset.id); const a = mm.dataset.thm;
      screen.querySelector('.bp-ig-menu')?.remove();
      if (a === 'del' && p) { feed.posts = feed.posts.filter((x) => x !== p); save(); if (view === 'post') view = 'feed'; view === 'profile' ? renderProfile() : renderFeed(); say('刪掉了'); }
      if (a === 'redo' && p) await rewritePost(p);
      return;
    }
    const like = e.target.closest('[data-like]');
    if (like) { e.stopPropagation(); const p = find(like.dataset.like); p.liked = !p.liked; save(); view === 'post' ? renderPost() : view === 'profile' ? renderProfile() : renderFeed(); return; }
    const rl = e.target.closest('[data-rlike]');
    if (rl) { const [pid, rid] = rl.dataset.rlike.split('|'); const r = find(pid)?.replies?.find((x) => x.id === rid); if (r) { r.liked = !r.liked; save(); renderPost(); } return; }
    const op = e.target.closest('[data-post]');
    if (op && view !== 'post') {
      openId = op.dataset.post; const p = find(openId); const from = view;
      backTo = from; renderPost();
      if (!p.replies) loadReplies(p);
      return;
    }
    const a = e.target.closest('[data-th]')?.dataset.th;
    if (!a) return;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'feed') renderFeed();
    if (a === 'profile') renderProfile();
    if (a === 'back') { backTo === 'profile' ? renderProfile() : renderFeed(); }
    if (a === 'refresh') refresh();
    if (a === 'compose') composer();
    if (a === 'unsheet') screen.querySelector('.bp-th-sheet')?.remove();
    if (a === 'nope') say('這裡還沒做');
    if (a === 'handle') {
      const v = prompt('妳在脆上的帳號', me().handle);
      if (v && v.trim()) { feed.handle = v.trim().replace(/^@/, '').replace(/\s+/g, '_'); feed.posts.forEach((p) => { if (p.author.kind === 'me') p.author.handle = feed.handle; (p.replies || []).forEach((r) => { if (r.author.kind === 'me') r.author.handle = feed.handle; }); }); save(); renderProfile(); }
    }
    if (a === 'post') {
      const text = screen.querySelector('.bp-th-sheet textarea').value.trim();
      if (!text) return;
      const p = { id: uid(), author: me(), text, ts: Date.now(), likes: 0, replies: null };
      feed.posts.push(p); save();
      screen.querySelector('.bp-th-sheet')?.remove();
      openId = p.id; backTo = 'feed'; renderPost();
      say('發佈了，等等會有人來留言');
      await new Promise((r) => setTimeout(r, 2500));
      if (!p.replies) loadReplies(p);
    }
  });

  screen.addEventListener('submit', (e) => {
    if (!mine()) return;
    e.preventDefault();
    const inp = screen.querySelector('.bp-th-bar input');
    const text = inp?.value.trim(); const p = find(openId);
    if (!text || !p) return;
    answer(p, text);
  });

  return { open() { view = 'feed'; render(); } };
}
