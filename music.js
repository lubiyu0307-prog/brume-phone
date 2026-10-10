// 音樂：他照自己的品味推薦歌，查得到的才給妳看，喜歡就加進你們的歌單。
// 歌的資料（封面、歌手、30 秒試聽）查 Apple 的公開資料庫；填了 YouTube 金鑰就能放整首。

import * as store from './store.js';
import { currentChar, generate } from './st.js';

const YT_KEY = 'brume-phone:ytkey';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (t) => String(t || '').toLowerCase().normalize('NFKC').replace(/[\s'’"「」『』()（）\-–—.,!?！？・·]/g, '');

const IC = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12L9.5 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l10.5-6z"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  added: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.2 3 3 6-6.4" fill="none" stroke="#121212" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9z"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
};

// ---------- 查歌：Apple 的公開資料庫（不用金鑰） ----------
// 有的瀏覽器擋 Apple 的跨網域讀取，擋到就改用 JSONP（script 標籤）再查一次
let useJsonp = false;
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = `bpIt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const el = document.createElement('script');
    const done = () => { delete window[cb]; el.remove(); };
    const timer = setTimeout(() => { done(); reject(new Error('查歌逾時')); }, 10000);
    window[cb] = (data) => { clearTimeout(timer); done(); resolve(data); };
    el.onerror = () => { clearTimeout(timer); done(); reject(new Error('查歌失敗')); };
    el.src = `${url}&callback=${cb}`;
    document.head.appendChild(el);
  });
}

async function itunes(term) {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=8&country=TW&term=${encodeURIComponent(term)}`;
  if (!useJsonp) {
    try {
      const r = await fetch(url);
      if (r.ok) return (await r.json()).results || [];
    } catch { /* 多半是跨網域被擋 */ }
    useJsonp = true;
  }
  return (await jsonp(url)).results || [];
}

/** 他說的歌真的存在嗎？存在就回傳整理好的歌，查不到回 null（模型很會編歌） */
export async function verify(title, artist) {
  let res = await itunes(`${title} ${artist}`).catch(() => []);
  if (!res.length) res = await itunes(title).catch(() => []);
  const nt = norm(title); const na = norm(artist);
  const hit = res.find((x) => {
    const tn = norm(x.trackName); const an = norm(x.artistName);
    const titleOk = tn === nt || tn.includes(nt) || nt.includes(tn);
    const artistOk = !na || an.includes(na) || na.includes(an);
    return titleOk && artistOk;
  });
  if (!hit) return null;
  return {
    id: String(hit.trackId),
    title: hit.trackName,
    artist: hit.artistName,
    album: hit.collectionName || '',
    cover: (hit.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
    preview: hit.previewUrl || '',
  };
}

// ---------- YouTube：有金鑰才能找影片放整首 ----------
async function ytFind(song) {
  const key = localStorage.getItem(YT_KEY);
  if (!key) return null;
  const q = encodeURIComponent(`${song.title} ${song.artist}`);
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&q=${q}&key=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error(r.status === 403 ? 'YouTube 金鑰不能用或額度用完了' : 'YouTube 找不到');
  const it = (await r.json()).items?.[0];
  return it?.id?.videoId || null;
}

function recPrompt(ch, have) {
  return [
    '[Brume Phone · 音樂]',
    `現在不是在寫劇情正文。${ch.user} 打開手機的音樂 App，想聽 ${ch.name} 推薦歌。`,
    `請照 ${ch.name} 自己的個性、品味、生活背景，挑 5 首他會想分享給 ${ch.user} 聽的歌。`,
    '- 只挑真的存在、在串流平台上找得到的歌，歌名和歌手要寫正確的原文',
    '- 可以是任何語言、任何年代，但要像他這個人會聽的',
    '- 每首配一句他想對她說的話（為什麼想給她聽），用他的語氣，20 字內',
    have.length ? `- 這些已經在歌單裡了，不要重複：${have.map((s) => `${s.title}／${s.artist}`).join('、')}` : '',
    '',
    '只輸出 5 行，每行格式：歌名｜歌手｜他想說的話',
    '不要編號、不要其他文字。',
  ].filter(Boolean).join('\n');
}

// ---------- 播放器（整個手機共用一個，關掉 App 也繼續放） ----------
const player = {
  audio: new Audio(),
  song: null, queue: [], mode: null, playing: false, ytHost: null, listeners: new Set(),
  emit() { for (const f of this.listeners) f(this); },
};
player.audio.addEventListener('play', () => { player.playing = true; player.emit(); });
player.audio.addEventListener('pause', () => { player.playing = false; player.emit(); });
player.audio.addEventListener('timeupdate', () => player.emit());
player.audio.addEventListener('ended', () => { player.playing = false; skip(1); });

function ytCommand(func) {
  const f = player.ytHost?.querySelector('iframe');
  f?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

async function playSong(song, queue) {
  player.song = song; if (queue) player.queue = queue;
  player.audio.pause();
  if (player.ytHost) player.ytHost.innerHTML = '';
  player.mode = null; player.playing = false; player.error = ''; player.emit();
  let vid = song.yt;
  if (!vid && localStorage.getItem(YT_KEY)) {
    try { vid = await ytFind(song); if (vid) song.yt = vid; } catch (e) { player.error = e.message; }
  }
  if (player.song !== song) return; // 中途換歌了
  if (vid && player.ytHost) {
    player.mode = 'yt';
    player.ytHost.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1&playsinline=1&enablejsapi=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    player.playing = true;
  } else if (song.preview) {
    player.mode = 'preview';
    player.audio.src = song.preview;
    player.audio.play().catch(() => {});
  } else {
    player.error ||= '這首沒有試聽片段，到設定填 YouTube 金鑰才放得出來。';
  }
  player.emit();
}

function toggle() {
  if (!player.song) return;
  if (player.mode === 'yt') { ytCommand(player.playing ? 'pauseVideo' : 'playVideo'); player.playing = !player.playing; player.emit(); }
  else if (player.audio.paused) player.audio.play().catch(() => {}); else player.audio.pause();
}

function skip(d) {
  const q = player.queue; if (!q.length || !player.song) return;
  const i = q.findIndex((s) => s.id === player.song.id);
  const next = q[(i + d + q.length) % q.length];
  if (next) playSong(next);
}

export const nowPlaying = {
  subscribe(f) { player.listeners.add(f); f(player); return () => player.listeners.delete(f); },
  toggle, skip,
};

export function createMusic({ screen, ytHost, say }) {
  player.ytHost = ytHost;
  let ch = null; let data = { playlist: [], recs: [] }; let view = 'home'; let loading = false;

  const save = () => ch && store.set('music:' + ch.key, data).catch(() => {});
  const inList = (id) => data.playlist.some((s) => s.id === id);

  async function render() {
    ch = currentChar();
    if (ch) data = (await store.get('music:' + ch.key).catch(() => null)) || { playlist: [], recs: [] };
    if (view === 'now' && player.song) renderNow(); else renderHome();
  }

  function row(s, kind) {
    const on = player.song?.id === s.id;
    return `<div class="bp-mu-row${on ? ' on' : ''}" data-play="${s.id}" data-from="${kind}">
      <img src="${esc(s.cover)}" alt="" loading="lazy">
      <div class="bp-mu-row-mid"><b>${esc(s.title)}</b><span>${esc(s.artist)}</span>${kind === 'recs' && s.reason ? `<em>「${esc(s.reason)}」</em>` : ''}</div>
      ${kind === 'recs'
        ? `<i class="bp-mu-add${inList(s.id) ? ' on' : ''}" data-add="${s.id}">${inList(s.id) ? IC.added : IC.add}</i>`
        : `<i class="bp-mu-del" data-del="${s.id}">${IC.del}</i>`}
    </div>`;
  }

  function renderHome() {
    const who = ch ? esc(ch.name) : '他';
    screen.innerHTML = `<div class="bp-mu">
      <div class="bp-mu-head"><span class="bp-back" data-mu="home">‹</span><b>音樂</b><i data-mu="settings">${IC.gear}</i></div>
      <div class="bp-mu-scroll">
        ${!ch ? '<p class="bp-mu-empty">先在酒館選一個角色，才知道是誰在推薦歌給妳。</p>' : `
        <div class="bp-mu-hero">
          <div><small>給妳的歌</small><h2>${who}想讓妳聽的</h2><p>照他的品味挑，查得到的歌才會出現在這裡。</p></div>
          <button data-mu="rec" ${loading ? 'disabled' : ''}>${IC.spark}${loading ? '他在挑⋯' : '讓他推薦'}</button>
        </div>
        ${data.recs.length ? `<h3>他剛剛挑的</h3><div class="bp-mu-list">${data.recs.map((s) => row(s, 'recs')).join('')}</div>` : ''}
        <h3>我們的歌單 <small>${data.playlist.length} 首</small></h3>
        <div class="bp-mu-list">${data.playlist.length ? data.playlist.map((s) => row(s, 'playlist')).join('') : '<p class="bp-mu-empty">還沒有歌。讓他推薦幾首，喜歡就按 ＋。</p>'}</div>`}
      </div>
      ${mini()}
    </div>`;
  }

  function mini() {
    const s = player.song;
    if (!s) return '';
    return `<div class="bp-mu-mini" data-mu="now">
      <img src="${esc(s.cover)}" alt=""><div><b>${esc(s.title)}</b><span>${esc(s.artist)}${player.mode === 'preview' ? '・試聽 30 秒' : ''}</span></div>
      <i data-mu="toggle">${player.playing ? IC.pause : IC.play}</i></div>`;
  }

  function renderNow() {
    const s = player.song;
    const a = player.audio;
    const pct = player.mode === 'preview' && a.duration ? (a.currentTime / a.duration) * 100 : 0;
    screen.innerHTML = `<div class="bp-mu bp-mu-now" style="--cover:url('${esc(s.cover)}')">
      <div class="bp-mu-head"><span class="bp-back bp-down" data-mu="homeview">${IC.down}</span><b>正在播放</b><span></span></div>
      <div class="bp-mu-stage">${player.mode === 'yt' ? '<div class="bp-mu-ytslot"></div>' : `<img src="${esc(s.cover)}" alt="">`}</div>
      <div class="bp-mu-meta"><b>${esc(s.title)}</b><span>${esc(s.artist)}</span>
        ${s.reason ? `<em>「${esc(s.reason)}」 —— ${esc(ch?.name || '他')}</em>` : ''}</div>
      ${player.mode === 'preview' ? `<div class="bp-mu-bar"><i style="width:${pct}%"></i></div><p class="bp-mu-hint">這是 30 秒試聽。到音樂 App 設定填 YouTube 金鑰就能放整首。</p>` : ''}
      ${player.mode === 'yt' ? '<p class="bp-mu-hint">如果沒有自己開始放，點一下影片。</p>' : ''}
      ${!player.mode ? `<p class="bp-mu-hint">${player.error ? esc(player.error) : '準備中⋯'}</p>` : ''}
      <div class="bp-mu-ctl"><i data-mu="prev">${IC.prev}</i><i class="big" data-mu="toggle">${player.playing ? IC.pause : IC.play}</i><i data-mu="next">${IC.next}</i></div>
    </div>`;
    placeYt();
  }

  // YouTube 的框一直活在手機裡，打開正在播放時才搬到畫面上
  function placeYt() {
    const slot = screen.querySelector('.bp-mu-ytslot');
    ytHost.classList.toggle('bp-yt-show', !!slot);
    if (slot) {
      const r = slot.getBoundingClientRect(); const p = ytHost.parentElement.getBoundingClientRect();
      Object.assign(ytHost.style, { left: `${r.left - p.left}px`, top: `${r.top - p.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    }
  }

  function settings() {
    const key = localStorage.getItem(YT_KEY) || '';
    screen.insertAdjacentHTML('beforeend', `<div class="bp-mu-sheet"><div class="bp-mu-sheet-bg" data-mu="unsheet"></div><div class="bp-mu-sheet-card">
      <b>放整首歌</b>
      <p>填一把 YouTube Data API 金鑰，就能在手機裡放整首。沒有填的話只能聽 30 秒試聽。</p>
      <p>申請：Google Cloud Console → 建專案 → 啟用「YouTube Data API v3」→ 憑證 → 建立 API 金鑰。免費，一天大約能找一百首。</p>
      <input class="bp-mu-key" placeholder="貼上金鑰" value="${esc(key)}" autocomplete="off">
      <div class="bp-mu-sheet-btns"><button data-mu="unsheet">取消</button><button class="ok" data-mu="savekey">儲存</button></div>
      <small>金鑰只存在這台裝置的瀏覽器裡，不會傳給別人。</small></div></div>`);
  }

  async function recommend() {
    if (loading || !ch) return;
    loading = true; renderHome();
    const who = ch; const d = data;
    try {
      const raw = await generate(recPrompt(who, d.playlist));
      const picks = raw.split('\n').map((l) => l.replace(/^\s*[\d.、\-*]+\s*/, '').split(/[｜|]/).map((x) => x.trim())).filter((p) => p.length >= 2 && p[0]);
      const found = (await Promise.all(picks.slice(0, 6).map(async ([t, a, why]) => {
        const s = await verify(t, a).catch(() => null);
        return s ? { ...s, reason: why || '' } : null;
      }))).filter(Boolean);
      const seen = new Set();
      d.recs = found.filter((s) => !seen.has(s.id) && seen.add(s.id));
      save();
      if (!d.recs.length) say('他挑的歌都查不到，再按一次試試');
      else if (d.recs.length < picks.length) say(`有 ${picks.length - d.recs.length} 首查不到，先拿掉了`);
    } catch (e) {
      say(`推薦失敗：${e.message || e}`);
    }
    loading = false;
    if (view === 'home' && currentChar()?.key === who.key) renderHome();
  }

  screen.addEventListener('click', (e) => {
    if (!screen.querySelector('.bp-mu')) return; // 不是音樂的畫面
    const t = e.target;
    const add = t.closest('[data-add]');
    if (add) {
      const s = data.recs.find((x) => x.id === add.dataset.add);
      if (s && !inList(s.id)) { data.playlist.push(s); say('加進歌單了'); } else if (s) { data.playlist = data.playlist.filter((x) => x.id !== s.id); }
      save(); renderHome(); return;
    }
    const del = t.closest('[data-del]');
    if (del) { data.playlist = data.playlist.filter((x) => x.id !== del.dataset.del); save(); renderHome(); return; }
    const play = t.closest('[data-play]');
    if (play) {
      const list = play.dataset.from === 'recs' ? data.recs : data.playlist;
      const s = list.find((x) => x.id === play.dataset.play);
      if (s) { playSong(s, list); view = 'now'; renderNow(); }
      return;
    }
    const a = t.closest('[data-mu]')?.dataset.mu;
    if (!a) return;
    if (a === 'toggle') { e.stopPropagation(); toggle(); return; }
    if (a === 'home') { ytHost.classList.remove('bp-yt-show'); screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true })); }
    if (a === 'homeview') { view = 'home'; ytHost.classList.remove('bp-yt-show'); renderHome(); }
    if (a === 'now') { view = 'now'; renderNow(); }
    if (a === 'prev') skip(-1);
    if (a === 'next') skip(1);
    if (a === 'rec') recommend();
    if (a === 'settings') settings();
    if (a === 'unsheet') screen.querySelector('.bp-mu-sheet')?.remove();
    if (a === 'savekey') {
      const v = screen.querySelector('.bp-mu-key').value.trim();
      try { if (v) localStorage.setItem(YT_KEY, v); else localStorage.removeItem(YT_KEY); } catch { /* 無痕模式存不了 */ }
      screen.querySelector('.bp-mu-sheet')?.remove(); say(v ? '金鑰存好了' : '金鑰拿掉了');
    }
  });

  // 播放狀態變了就更新畫面（只動需要動的地方，不整頁重畫）
  nowPlaying.subscribe(() => {
    if (!screen.querySelector('.bp-mu')) return;
    if (view === 'now' && player.song) {
      const bar = screen.querySelector('.bp-mu-bar i');
      const a = player.audio;
      if (bar && a.duration) bar.style.width = `${(a.currentTime / a.duration) * 100}%`;
      const big = screen.querySelector('.bp-mu-ctl .big'); if (big) big.innerHTML = player.playing ? IC.pause : IC.play;
      const shown = screen.querySelector('.bp-mu-meta b')?.textContent;
      const modeShown = !!screen.querySelector('.bp-mu-ytslot') ? 'yt' : (screen.querySelector('.bp-mu-bar') ? 'preview' : null);
      if (shown !== player.song.title || modeShown !== player.mode) renderNow();
      else if (!player.mode && player.error) { const h = screen.querySelector('.bp-mu-hint'); if (h) h.textContent = player.error; }
    } else {
      const m = screen.querySelector('.bp-mu-mini');
      const fresh = mini();
      if (m) m.outerHTML = fresh; else if (fresh) screen.querySelector('.bp-mu')?.insertAdjacentHTML('beforeend', fresh);
      screen.querySelectorAll('.bp-mu-row').forEach((r) => r.classList.toggle('on', r.dataset.play === player.song?.id));
    }
  });

  return {
    open() { view = player.song ? view : 'home'; render(); },
    leave() { ytHost.classList.remove('bp-yt-show'); },
  };
}
