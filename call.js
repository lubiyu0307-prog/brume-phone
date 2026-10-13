// 電話：撥給他，像在講電話。他說的話會一句一句出現在畫面上，也可以用手機內建的聲音唸出來。
// 妳打字（或用鍵盤上的麥克風講）回他。掛掉之後留一筆通話紀錄。

import * as store from './store.js';
import { currentChar, generate } from './st.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dur = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const VOICE_KEY = 'brume-phone:voice';
const voiceOn = () => { try { return localStorage.getItem(VOICE_KEY) !== '0'; } catch { return true; } };

const IC = {
  phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h3l5-4v14l-5-4H5z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h3l5-4v14l-5-4H5z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
};

export function createCall({ screen, say }) {
  let ch = null; let log = []; let call = null; let timer = null;
  const mine = () => !!screen.querySelector('.bp-ca');
  const speak = (text) => {
    if (!voiceOn() || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[（(][^）)]*[）)]/g, ''));
    u.lang = 'zh-TW'; u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => /zh[-_]TW/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  };

  async function list() {
    ch = currentChar();
    if (!ch) { screen.innerHTML = '<div class="bp-ca bp-ca-list"><div class="bp-ca-head"><span class="bp-back" data-ca="home">‹</span><b>電話</b><span></span></div><p class="bp-ca-empty">先在酒館選一個角色。</p></div>'; return; }
    log = (await store.get('calls:' + ch.key).catch(() => null)) || [];
    screen.innerHTML = `<div class="bp-ca bp-ca-list">
      <div class="bp-ca-head"><span class="bp-back" data-ca="home">‹</span><b>電話</b><span></span></div>
      <div class="bp-ca-contact">${ch.avatar ? `<img src="${ch.avatar}" alt="">` : `<span>${esc(ch.name.slice(0, 1))}</span>`}<b>${esc(ch.name)}</b>
        <button data-ca="dial">${IC.phone} 撥給他</button></div>
      <h4>最近通話</h4>
      ${log.length ? [...log].reverse().slice(0, 30).map((c) => `<div class="bp-ca-log" data-open="${c.ts}"><b>${esc(ch.name)}</b><span>${c.lines?.length ? `${dur(c.dur)}・${esc(c.lines[c.lines.length - 1].text).slice(0, 18)}` : '未接通'}</span><small>${new Date(c.ts).getMonth() + 1}/${new Date(c.ts).getDate()} ${pad(new Date(c.ts).getHours())}:${pad(new Date(c.ts).getMinutes())}</small></div>`).join('') : '<p class="bp-ca-empty">還沒有通話紀錄。</p>'}
      <label class="bp-ca-voice"><input type="checkbox" ${voiceOn() ? 'checked' : ''}> 用手機內建的聲音唸出他說的話</label>
    </div>`;
  }

  function room() {
    const sec = call.start ? Math.floor((Date.now() - call.start) / 1000) : 0;
    screen.innerHTML = `<div class="bp-ca bp-ca-room">
      <div class="bp-ca-who">${ch.avatar ? `<img src="${ch.avatar}" alt="">` : `<span>${esc(ch.name.slice(0, 1))}</span>`}<b>${esc(ch.name)}</b><small class="bp-ca-time">${call.start ? dur(sec) : '撥號中⋯'}</small></div>
      <div class="bp-ca-lines">${call.lines.map((l) => `<p class="${l.me ? 'me' : 'him'}">${esc(l.text)}</p>`).join('')}${call.thinking ? '<p class="him dim">⋯</p>' : ''}</div>
      <form class="bp-ca-bar"><input placeholder="說點什麼⋯" enterkeyhint="send" ${call.start ? '' : 'disabled'}><button>說</button></form>
      <div class="bp-ca-btns"><span data-ca="voice">${voiceOn() ? IC.speaker : IC.mute}<i>${voiceOn() ? '擴音' : '靜音'}</i></span><span class="end" data-ca="hang">${IC.phone}</span><span></span></div>
    </div>`;
    const box = screen.querySelector('.bp-ca-lines'); box.scrollTop = box.scrollHeight;
  }

  async function hisTurn(first) {
    call.thinking = true; room();
    const who = ch;
    try {
      const t = await generate([
        '[Brume Phone · 電話]',
        `現在不是在寫劇情正文。${who.user} 打電話給 ${who.name}，兩人正在講電話。照他的個性、你們現在的關係、最近的劇情和現在的時間說話。`,
        '- 這是說出口的話：口語、自然，一次 1～3 句，可以有停頓（⋯）',
        '- 不寫動作、旁白、表情描寫，只寫他說的話',
        first ? `- 他剛接起電話，先開口（例如「喂？」之後接一兩句）` : '',
        '', '通話到目前：', call.lines.map((l) => `${l.me ? who.user : who.name}：${l.text}`).join('\n') || '（剛接通）',
      ].filter(Boolean).join('\n'));
      const text = t.trim().replace(new RegExp(`^${who.name}\\s*[:：]\\s*`), '').split('\n').filter(Boolean).slice(0, 3).join(' ');
      if (text && call) { call.lines.push({ me: false, text }); speak(text); }
    } catch (e) { say(`訊號不好：${e.message || e}`); }
    if (call) { call.thinking = false; if (mine()) room(); }
  }

  async function dial() {
    call = { ts: Date.now(), lines: [], start: 0 };
    room();
    if (window.speechSynthesis) speechSynthesis.cancel();
    await new Promise((r) => setTimeout(r, 1800 + Math.random() * 1500));
    if (!call) return;
    call.start = Date.now();
    clearInterval(timer);
    timer = setInterval(() => { const el = screen.querySelector('.bp-ca-time'); if (el && call?.start) el.textContent = dur(Math.floor((Date.now() - call.start) / 1000)); }, 1000);
    hisTurn(true);
  }

  async function hang() {
    clearInterval(timer);
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (call) {
      log.push({ ts: call.ts, dur: call.start ? Math.floor((Date.now() - call.start) / 1000) : 0, lines: call.lines });
      log = log.slice(-50);
      await store.set('calls:' + ch.key, log).catch(() => {});
    }
    call = null; list();
  }

  function replay(ts) {
    const c = log.find((x) => String(x.ts) === String(ts));
    if (!c?.lines?.length) return;
    screen.innerHTML = `<div class="bp-ca bp-ca-list"><div class="bp-ca-head"><span class="bp-back" data-ca="list">‹</span><b>${dur(c.dur)}</b><span></span></div>
      <div class="bp-ca-lines light">${c.lines.map((l) => `<p class="${l.me ? 'me' : 'him'}">${esc(l.text)}</p>`).join('')}</div></div>`;
  }

  screen.addEventListener('click', (e) => {
    if (!mine()) return;
    const op = e.target.closest('[data-open]'); if (op) { replay(op.dataset.open); return; }
    const a = e.target.closest('[data-ca]')?.dataset.ca;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'list') list();
    if (a === 'dial') dial();
    if (a === 'hang') hang();
    if (a === 'voice') { try { localStorage.setItem(VOICE_KEY, voiceOn() ? '0' : '1'); } catch { /* 存不了 */ } if (!voiceOn() && window.speechSynthesis) speechSynthesis.cancel(); room(); }
  });
  screen.addEventListener('change', (e) => {
    if (!mine() || !e.target.closest('.bp-ca-voice')) return;
    try { localStorage.setItem(VOICE_KEY, e.target.checked ? '1' : '0'); } catch { /* 存不了 */ }
  });
  screen.addEventListener('submit', (e) => {
    if (!mine()) return;
    e.preventDefault();
    const inp = screen.querySelector('.bp-ca-bar input'); const text = inp?.value.trim();
    if (!text || !call?.start || call.thinking) return;
    call.lines.push({ me: true, text }); hisTurn(false);
  });

  return { open() { call = null; list(); }, get inCall() { return !!call; }, hang };
}
