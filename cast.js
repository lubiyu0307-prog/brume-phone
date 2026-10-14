// 證件照：他、妳、配角各一張參考照片＋長相描述，照角色卡存（同一張卡的每個聊天共用）。
// 相本的「證件照」分頁和 IG 點配角頭像打開的是同一份；快照和 IG 生圖時拿這裡的照片給 Gemini 當參考。
// 他和妳的長相文字沿用舊的 look:（以前相本「長相」頁存的），照片和配角存在 cast:。
// look.style 是玩家寫的照片風格（濾鏡、畫風），每張生圖都套用。

import * as store from './store.js';

export const HIM = '@him';
export const ME = '@me';

export async function loadCast(charKey) {
  const cast = (await store.get('cast:' + charKey).catch(() => null)) || {};
  const look = { him: '', me: '', style: '', ...((await store.get('look:' + charKey).catch(() => null)) || {}) };
  // 證件照沒放他的照片時，拿角色卡的頭像當參考，不然 Gemini 會自己捏一張臉（10/14 企鵝那張）
  const cardAvatar = /\.(png|webp|jpe?g)$/i.test(charKey) ? `/characters/${encodeURIComponent(charKey)}` : '';
  return { cast, look, cardAvatar };
}

export function saveCast(charKey, { cast, look }) {
  return Promise.all([store.set('cast:' + charKey, cast), store.set('look:' + charKey, look)]).catch(() => {});
}

/** 某個人的資料：{ name, photo, look } */
export function person({ cast, look }, ch, id) {
  if (id === HIM) return { id, name: ch.name, photo: cast[HIM]?.photo || '', look: look.him || '' };
  if (id === ME) return { id, name: ch.user, photo: cast[ME]?.photo || '', look: look.me || '' };
  return { id, name: id, photo: cast[id]?.photo || '', look: cast[id]?.look || '' };
}

export function setPerson(data, id, { photo, look }) {
  if (id === HIM || id === ME) {
    data.look[id === HIM ? 'him' : 'me'] = look || '';
    if (photo) data.cast[id] = { photo }; else delete data.cast[id];
    return;
  }
  if (photo || look) data.cast[id] = { photo: photo || '', look: look || '' }; else delete data.cast[id];
}

/** 配角名單（不含他和妳） */
export const sideNames = ({ cast }) => Object.keys(cast).filter((k) => k !== HIM && k !== ME);

/** 這張照片裡有誰：always 是一定在照片裡的人（例如快照裡的他），再加上文字裡出現名字的配角 */
export function idsFor(data, text, always = []) {
  const ids = [...always];
  for (const n of sideNames(data)) if (String(text).includes(n) && !ids.includes(n)) ids.push(n);
  return ids;
}

/** 入鏡的人的參考照片（最多三張） */
export function refsFor(data, ch, text, always = []) {
  return idsFor(data, text, always).map((id) => ({ ...person(data, ch, id), url: person(data, ch, id).photo || (id === HIM ? data.cardAvatar : '') }))
    .filter((p) => p.url).slice(0, 3).map((p) => ({ name: p.name, url: p.url }));
}

/**
 * 送去生圖的完整 prompt：場景 prompt＋入鏡的人的長相（髮色、身形這些要照做）＋玩家寫的照片風格。
 * 長相直接接在最後，不靠寫 prompt 的模型轉述，轉述常把髮色、身材改掉
 */
export function finalPrompt(data, ch, prompt, ids = [], { by } = {}) {
  const notes = ids.map((id) => person(data, ch, id)).filter((p) => p.look).map((p) => `${p.name}: ${p.look}`);
  // 拍照的人：他自己拍的照片常常只有手入鏡（托著東西、拿著杯子），不講是誰的手，模型會隨便畫一隻（10/14 阿愷的企鵝變成女生的手）。
  // 只講性別，不貼整段長相：貼了模型會把整個人畫進去（同一天第二張，冒出一個陌生男人）
  const cam = by && !ids.includes(by) ? person(data, ch, by) : null;
  const sex = cam && (/\b(1boy|male|man|boy)\b/i.test(cam.look) || /男/.test(cam.look) ? "a man's" : /\b(1girl|female|woman|girl)\b/i.test(cam.look) || /女/.test(cam.look) ? "a woman's" : '');
  return [
    String(prompt).trim(),
    cam ? `First-person shot taken by ${cam.name} on their own phone. ${cam.name} is NOT in the photo: no face, no body. If a hand or arm reaches into the frame, it is ${cam.name}'s own${sex ? ` (${sex} hand)` : ''}.` : '',
    notes.length ? `Appearance to keep exactly (hair colour, body shape, clothes):\n${notes.join('\n')}` : '',
    data.look.style ? `Photo style / filter: ${data.look.style}` : '',
  ].filter(Boolean).join('\n');
}
