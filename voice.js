// 他的聲音。角色卡在 data.extensions.voice.gemini 寫了 { name, style } 就用 Gemini 語音念，
// 每個玩家聽到的都是同一個聲音：
//   一、酒館本身接 AI Studio → 借酒館的連線（/api/google/generate-native-tts），玩家什麼都不用設
//   二、酒館接 Vertex 或 Claude → 用玩家貼在手機裡的 AI Studio 金鑰（Vertex 快速模式碰不到語音模型）
//   三、都沒有 → 回傳 false，讓電話改用裝置內建的聲音

import { ctx } from './st.js';

const KEY = 'brume-phone:gemini-key';
// 3.8 是現在的；舊的 2.5 留著當備援（新模型沒開放或額度用完時）
const MODELS = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];

export const geminiKey = {
  get() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(v) { try { v ? localStorage.setItem(KEY, v.trim()) : localStorage.removeItem(KEY); } catch { /* 存不了就算了 */ } },
};

export function cardVoice() {
  const c = ctx(); const ch = c?.characters?.[c?.characterId];
  const v = ch?.data?.extensions?.voice?.gemini;
  return v && v.name ? { name: String(v.name), style: String(v.style || '') } : null;
}

const viaTavern = () => ctx()?.chatCompletionSettings?.chat_completion_source === 'makersuite';
export function route() {
  if (!cardVoice()) return null;
  if (viaTavern()) return 'tavern';
  if (geminiKey.get()) return 'key';
  return null;
}

// Gemini 回的可能是裸 PCM（audio/L16），也可能已經是完整 WAV（3.8 起）。已經是 WAV 就原樣用，
// 不要再包一層——包了會把它的檔頭和結尾的生成標記當聲音播出來，變成頭尾的「呲」
function toWav(bytes, mime) {
  const isRiff = bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF';
  if (isRiff) return new Blob([bytes], { type: 'audio/wav' });
  const rate = Number(/rate=(\d+)/.exec(mime || '')?.[1] || 24000);
  const h = new DataView(new ArrayBuffer(44));
  const w = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); h.setUint32(4, 36 + bytes.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
  w(36, 'data'); h.setUint32(40, bytes.length, true);
  return new Blob([h.buffer, bytes], { type: 'audio/wav' });
}

async function synthTavern(text, voice, model) {
  const c = ctx(); const o = c.chatCompletionSettings || {};
  const r = await fetch('/api/google/generate-native-tts', {
    method: 'POST', headers: c.getRequestHeaders(),
    body: JSON.stringify({ api: 'makersuite', text, voice, model, reverse_proxy: o.reverse_proxy, proxy_password: o.proxy_password }),
  });
  if (!r.ok) throw Object.assign(new Error(`語音 ${r.status}`), { status: r.status });
  const bytes = new Uint8Array(await r.arrayBuffer());
  return toWav(bytes, r.headers.get('content-type'));
}

async function synthKey(text, voice, model) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', referrerPolicy: 'strict-origin-when-cross-origin', // 酒館整頁 no-referrer，金鑰若限制網站會被擋
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey.get() },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`語音 ${r.status}`), { status: r.status });
  const part = (await r.json())?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('語音沒有回聲音');
  const bin = atob(part.inlineData.data); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return toWav(bytes, part.inlineData.mimeType);
}

export async function synth(text) {
  const how = route(); const v = cardVoice();
  if (!how || !v) return null;
  // 口氣說明跟台詞直接接在一起，句子一短模型就分不清，會把說明也念出來（10/13 比比聽到阿愷在念 prompt）。
  // 照官方的寫法用標題隔開：導演筆記只是說明，逐字稿才是要念的
  const said = v.style ? `### DIRECTOR'S NOTES（只是說明，不要念出來）\n${v.style}\n\n#### TRANSCRIPT（只念這一段）\n${text}` : text;
  let err;
  for (const model of MODELS) {
    try { return await (how === 'tavern' ? synthTavern : synthKey)(said, v.name, model); }
    catch (e) { err = e; if (![400, 403, 404, 429].includes(e.status)) break; } // 模型不存在或額度滿了才換下一個
  }
  throw err;
}

// 一句一句排隊念，掛電話時 stop() 全部停掉
let queue = Promise.resolve(); let current = null; let gen = 0;
export function say(text, onFail) {
  const my = gen;
  const job = synth(text).catch((e) => { onFail?.(e); return null; });
  queue = queue.then(async () => {
    const blob = await job;
    if (!blob || my !== gen) return;
    const url = URL.createObjectURL(blob);
    await new Promise((res) => {
      current = new Audio(url);
      current.onended = current.onerror = () => { URL.revokeObjectURL(url); res(); };
      current.play().catch(res);
    });
    current = null;
  });
}
export function stop() {
  gen++; queue = Promise.resolve();
  if (current) { try { current.pause(); } catch { /* 已經停了 */ } current = null; }
}
