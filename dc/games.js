// 小遊戲：跟他一起玩。猜拳（他會有反應）、幫我選（他照自己的想法挑）、真心話（他問妳或妳問他）。

import * as store from './store.js';
import { currentChar, generate } from './st.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HANDS = [{ id: 'rock', e: '✊', n: '石頭' }, { id: 'scissors', e: '✌️', n: '剪刀' }, { id: 'paper', e: '✋', n: '布' }];
const beats = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

function parseJSON(raw) {
  const t = raw.replace(/```(?:json)?/gi, '');
  const i = t.indexOf('{'); const j = t.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('沒有生出內容');
  return JSON.parse(t.slice(i, j + 1));
}

export function createGames({ screen, say }) {
  let ch = null; let view = 'menu'; let score = { me: 0, him: 0, tie: 0 };
  let rps = null; let pick = null; let truth = null; let busy = false;
  const mine = () => !!screen.querySelector('.bp-gm');
  const head = (title, back = 'menu') => `<div class="bp-gm-head"><span class="bp-back" data-gm="${back}">‹</span><b>${title}</b><span></span></div>`;
  const ask = (task) => generate(`[Brume Phone · 小遊戲]\n現在不是在寫劇情正文。${ch.user} 用手機跟 ${ch.name} 玩小遊戲。照 ${ch.name} 的個性、你們現在的關係和最近的劇情來回應，語氣像在傳訊息，短短的。\n\n${task}`);

  function render() {
    ch = currentChar();
    if (!ch) { screen.innerHTML = `<div class="bp-gm">${head('小遊戲', 'home')}<p class="bp-gm-empty">先在酒館選一個角色。</p></div>`; return; }
    if (view === 'rps') return renderRps();
    if (view === 'pick') return renderPick();
    if (view === 'truth') return renderTruth();
    screen.innerHTML = `<div class="bp-gm">${head('小遊戲', 'home')}
      <div class="bp-gm-menu">
        <div class="bp-gm-card" data-go="rps"><i>✊✌️✋</i><b>猜拳</b><span>贏了可以叫他做一件事</span></div>
        <div class="bp-gm-card" data-go="pick"><i>🎲</i><b>幫我選</b><span>選不下去的時候，問他</span></div>
        <div class="bp-gm-card" data-go="truth"><i>💬</i><b>真心話</b><span>他問妳，或妳問他</span></div>
      </div></div>`;
  }

  function renderRps() {
    screen.innerHTML = `<div class="bp-gm">${head('猜拳')}
      <div class="bp-gm-score"><span>妳 <b>${score.me}</b></span><span>平手 <b>${score.tie}</b></span><span>${esc(ch.name)} <b>${score.him}</b></span></div>
      <div class="bp-gm-arena">
        ${rps ? `<div class="bp-gm-vs"><div><i>${HANDS.find((h) => h.id === rps.me).e}</i><small>妳</small></div><em>${rps.result === 'win' ? '妳贏了' : rps.result === 'lose' ? '妳輸了' : '平手'}</em><div><i>${HANDS.find((h) => h.id === rps.him).e}</i><small>${esc(ch.name)}</small></div></div>
          <p class="bp-gm-say">${rps.line ? esc(rps.line) : '⋯'}</p>` : '<p class="bp-gm-say">出拳吧。</p>'}
      </div>
      <div class="bp-gm-hands">${HANDS.map((h) => `<button data-hand="${h.id}" ${busy ? 'disabled' : ''}><i>${h.e}</i>${h.n}</button>`).join('')}</div></div>`;
  }

  function renderPick() {
    screen.innerHTML = `<div class="bp-gm">${head('幫我選')}
      <div class="bp-gm-scroll">
        <label>要選什麼？</label><input class="bp-gm-q" placeholder="例如：晚餐吃什麼" value="${esc(pick?.q || '')}">
        <label>選項（一行一個）</label><textarea class="bp-gm-opts" rows="5" placeholder="拉麵\n火鍋\n便利商店">${esc(pick?.opts || '')}</textarea>
        <button class="bp-gm-go" data-gm="pickgo" ${busy ? 'disabled' : ''}>${busy ? '他在想⋯' : '問他'}</button>
        ${pick?.answer ? `<div class="bp-gm-answer"><b>${esc(pick.answer)}</b><p>${esc(pick.why)}</p></div>` : ''}
      </div></div>`;
  }

  function renderTruth() {
    screen.innerHTML = `<div class="bp-gm">${head('真心話')}
      <div class="bp-gm-scroll">
        <div class="bp-gm-two"><button data-gm="heasks" ${busy ? 'disabled' : ''}>他問我</button><button data-gm="iask">我問他</button></div>
        ${truth?.mode === 'he' ? `
          <div class="bp-gm-bubble him">${truth.q ? esc(truth.q) : '⋯'}</div>
          ${truth.q && !truth.reply ? `<textarea class="bp-gm-ans" rows="3" placeholder="老實回答喔"></textarea><button class="bp-gm-go" data-gm="answer" ${busy ? 'disabled' : ''}>${busy ? '⋯' : '回答'}</button>` : ''}
          ${truth.a ? `<div class="bp-gm-bubble me">${esc(truth.a)}</div>` : ''}
          ${truth.reply ? `<div class="bp-gm-bubble him">${esc(truth.reply)}</div>` : ''}` : ''}
        ${truth?.mode === 'me' ? `
          ${truth.q ? `<div class="bp-gm-bubble me">${esc(truth.q)}</div>` : `<textarea class="bp-gm-ans" rows="3" placeholder="想問他什麼？"></textarea><button class="bp-gm-go" data-gm="askhim" ${busy ? 'disabled' : ''}>${busy ? '⋯' : '問'}</button>`}
          ${truth.reply ? `<div class="bp-gm-bubble him">${esc(truth.reply)}</div>` : truth.q ? '<div class="bp-gm-bubble him">⋯</div>' : ''}` : ''}
        ${!truth ? '<p class="bp-gm-empty">選一個開始。真心話要說真的喔。</p>' : ''}
      </div></div>`;
  }

  async function play(hand) {
    const him = ['rock', 'scissors', 'paper'][Math.floor(Math.random() * 3)];
    const result = hand === him ? 'tie' : beats[hand] === him ? 'win' : 'lose';
    score[result === 'win' ? 'me' : result === 'lose' ? 'him' : 'tie']++;
    store.set('rps:' + ch.key, score).catch(() => {});
    rps = { me: hand, him, result, line: '' }; busy = true; renderRps();
    try {
      rps.line = (await ask(`猜拳：${ch.user} 出${HANDS.find((h) => h.id === hand).n}，你出${HANDS.find((h) => h.id === him).n}，${result === 'win' ? '她贏了' : result === 'lose' ? '你贏了' : '平手'}。目前比分：她 ${score.me}、你 ${score.him}。用一兩句話反應（可以耍賴、討價還價、要她兌現賭注）。只寫你說的話。`)).trim().split('\n').filter(Boolean).slice(0, 2).join('\n');
    } catch { rps.line = ''; }
    busy = false; if (mine() && view === 'rps') renderRps();
  }

  screen.addEventListener('click', async (e) => {
    if (!mine()) return;
    const go = e.target.closest('[data-go]');
    if (go) { view = go.dataset.go; if (view === 'rps') score = (await store.get('rps:' + ch.key).catch(() => null)) || { me: 0, him: 0, tie: 0 }; render(); return; }
    const h = e.target.closest('[data-hand]'); if (h && !busy) { play(h.dataset.hand); return; }
    const a = e.target.closest('[data-gm]')?.dataset.gm;
    if (!a) return;
    if (a === 'home') screen.dispatchEvent(new CustomEvent('bp-home', { bubbles: true }));
    if (a === 'menu') { view = 'menu'; render(); }
    if (a === 'pickgo') {
      const q = screen.querySelector('.bp-gm-q').value.trim(); const opts = screen.querySelector('.bp-gm-opts').value.trim();
      const list = opts.split('\n').map((x) => x.trim()).filter(Boolean);
      if (list.length < 2) { say('至少兩個選項'); return; }
      pick = { q, opts }; busy = true; renderPick();
      try {
        const r = parseJSON(await ask(`幫我選：她在煩惱「${q || '要選哪個'}」，選項有：${list.join('、')}。照你對她的了解和你自己的想法挑一個，理由用你的語氣講一兩句。只輸出 JSON：{"pick":"選項原文","why":""}`));
        pick.answer = String(r.pick || list[0]); pick.why = String(r.why || '');
      } catch (err) { say(`他沒想出來：${err.message || err}`); }
      busy = false; if (mine()) renderPick();
    }
    if (a === 'heasks') {
      truth = { mode: 'he' }; busy = true; renderTruth();
      try { truth.q = (await ask(`真心話：你想問她一個真心話問題。照你們現在的關係，問你真的好奇、平常不好意思問的事。只寫問題本身。`)).trim().split('\n')[0]; } catch { truth.q = '最近有沒有什麼事，是妳想跟我說但還沒說的？'; }
      busy = false; if (mine()) renderTruth();
    }
    if (a === 'answer') {
      const ans = screen.querySelector('.bp-gm-ans').value.trim(); if (!ans) return;
      truth.a = ans; busy = true; renderTruth();
      try { truth.reply = (await ask(`真心話：你問她「${truth.q}」，她回答「${ans}」。用一兩句話回應她的答案。只寫你說的話。`)).trim(); } catch { truth.reply = ''; }
      busy = false; if (mine()) renderTruth();
    }
    if (a === 'iask') { truth = { mode: 'me' }; renderTruth(); }
    if (a === 'askhim') {
      const q = screen.querySelector('.bp-gm-ans').value.trim(); if (!q) return;
      truth.q = q; busy = true; renderTruth();
      try { truth.reply = (await ask(`真心話：她問你「${q}」。這是真心話，要說實話，可以害羞、可以猶豫，但要回答。只寫你說的話。`)).trim(); } catch { truth.reply = ''; }
      busy = false; if (mine()) renderTruth();
    }
  });

  return { open() { view = 'menu'; rps = null; render(); } };
}
