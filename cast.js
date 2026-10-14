// 證件照：他、妳、配角各一張參考照片＋長相描述，照角色卡存（同一張卡的每個聊天共用）。
// 相本的「證件照」分頁和 IG 點配角頭像打開的是同一份；快照和 IG 生圖時拿這裡的照片給 Gemini 當參考。
// 他和妳的長相文字沿用舊的 look:（以前相本「長相」頁存的），照片和配角存在 cast:。

import * as store from './store.js';

export const HIM = '@him';
export const ME = '@me';

export async function loadCast(charKey) {
  const cast = (await store.get('cast:' + charKey).catch(() => null)) || {};
  const look = (await store.get('look:' + charKey).catch(() => null)) || { him: '', me: '' };
  return { cast, look };
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

/**
 * 這張照片裡有誰，就帶誰的參考照片（最多三張）。always 是一定在照片裡的人（例如快照裡的他）
 */
export function refsFor(data, ch, text, always = []) {
  const ids = [...always];
  for (const n of sideNames(data)) if (String(text).includes(n) && !ids.includes(n)) ids.push(n);
  return ids.map((id) => person(data, ch, id)).filter((p) => p.photo).slice(0, 3).map((p) => ({ name: p.name, url: p.photo }));
}
