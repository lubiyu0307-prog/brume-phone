// 證件照：他、妳、配角各一張參考照片＋長相描述，照角色卡存（同一張卡的每個聊天共用）。
// 相本的「證件照」分頁和 IG 點配角頭像打開的是同一份；快照和 IG 生圖時拿這裡的照片給 Gemini 當參考。
// 他和妳的長相文字沿用舊的 look:（以前相本「長相」頁存的），照片和配角存在 cast:。
// look.style 是玩家寫的照片風格（濾鏡、畫風），每張生圖都套用。

import * as store from './store.js';
import { lookAt, asDataUrl } from './st.js';
import { P } from './prompts.js';

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

/**
 * 玩家沒寫照片風格時，看一眼角色卡頭像自己判斷畫風（寫實或動漫），記在 look.autoStyle，一張卡只判斷一次。
 * 動漫風的卡不寫風格，生出來會是寫實照片，跟卡對不上
 */
export async function ensureAutoStyle(data, charKey) {
  if (data.look.style || data.look.autoStyle || !data.cardAvatar) return;
  try {
    const img = await asDataUrl(data.cardAvatar);
    if (!img) return;
    const t = await lookAt('Look at this character image. Reply with one line of image-generation style tags in English: if it is a realistic photo reply exactly "realistic photo"; if it is anime, illustration or 3D, describe the art style (e.g. "anime style, cel shading, soft colours"). Output only that line.', img);
    const line = String(t || '').trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').slice(0, 160);
    if (!line) return;
    data.look.autoStyle = line;
    await saveCast(charKey, data);
  } catch { /* 判斷不了就照寫實 */ }
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
// 長相裡講臉、髮色、髮型、眼睛、膚色、年紀的詞：有參考照片的人，這些交給照片決定，文字留著反而會蓋過照片
// （10/14 企鵝館：文字寫 honey brown hair，Gemini 照字畫成橘髮，臉也跑掉）
// 年紀、成熟這類字也拿掉：有照片時年紀照片看得出來，「mature male」會被 Pro 照字面畫成中年大叔（10/14 兩次）
const FACE_TAG = /hair|bang|fringe|undercut|eye|face|skin|freckle|beard|mustache|lips?\b|nose|eyebrow|\d+\s*(years?|yo)\b|\bage\b|\bmature\b|middle[- ]aged|elderly|\bold(er)?\b|\byoung\b|youthful|\bteen|\b1(boy|girl)\b|\bsolo\b|髮|瀏海|眼|臉|膚|歲|鬍|成熟|中年|年輕|少年/i;
const stripFace = (text) => String(text).split(/[,，、]/).map((t) => t.trim()).filter((t) => t && !FACE_TAG.test(t)).join(/[\u4e00-\u9fff]/.test(text) ? '，' : ', ');
// 長相裡的衣服當「衣櫃」：玩家常把他會穿的衣服全列上去，整串送去生圖會被混搭成一身（10/14 員工 Polo 衫配灰色運動褲）
const CLOTHES = /shirt|polo|tee|t-shirt|top|jeans|pants|trousers|shorts|sweatpants|jogger|jacket|coat|hoodie|sweater|cardigan|knit|vest|dress|skirt|suit|uniform|lanyard|badge|apron|scarf|tie|socks|shoes|sneakers|boots|cap|hat|衣|衫|褲|裙|外套|帽|鞋|圍裙|制服|識別證/i;
export const splitLook = (text) => {
  const tags = stripFace(text).split(', ').filter(Boolean);
  return { body: tags.filter((t) => !CLOTHES.test(t)).join(', '), wardrobe: tags.filter((t) => CLOTHES.test(t)).join(', ') };
};
const lookNote = (text) => {
  const { body, wardrobe } = splitLook(text);
  return [body ? P.BODY(body) : '', wardrobe ? P.WARDROBE(wardrobe) : ''].filter(Boolean).join(P.SEP);
};
const hasRef = (data, p) => !!(p.photo || (p.id === HIM && data.cardAvatar));

export function finalPrompt(data, ch, prompt, ids = [], { by } = {}) {
  const inFrame = ids.map((id) => person(data, ch, id));
  const anyRef = inFrame.some((p) => hasRef(data, p));
  // 有照片的人：臉和頭髮照照片，文字只留身形、衣著；沒照片的人照舊整段長相
  const notes = inFrame.filter((p) => p.look || hasRef(data, p)).map((p) => (hasRef(data, p)
    ? `${P.PERSON_WITH_REF(p.name)}${lookNote(p.look) ? `${P.SEP}${lookNote(p.look)}` : ''}`
    : `${p.name}${P.COLON}${lookNote(p.look) || p.look}`));
  // 場景 prompt 裡寫長相的詞也拿掉（寫 prompt 的模型會把長相抄進去），沒照片的人的長相上面 notes 會補回來
  if (anyRef) prompt = stripFace(prompt);
  // 拍照的人：他自己拍的照片常常只有手入鏡（托著東西、拿著杯子），不講是誰的手，模型會隨便畫一隻（10/14 阿愷的企鵝變成女生的手）。
  // 只講性別，不貼整段長相：貼了模型會把整個人畫進去（同一天第二張，冒出一個陌生男人）
  const cam = by && !ids.includes(by) ? person(data, ch, by) : null;
  const style = data.look.style || data.look.autoStyle || '';
  // 長相裡跟手有關的詞（膚色、手指、指節、青筋、手毛）也帶上，只講「男生的手」會被畫成刻板的毛手（10/14 第三張）
  const hand = cam ? cam.look.split(/[,，、]/).map((t) => t.trim()).filter((t) => /skin|finger|knuckle|vein|hand|nail|wrist|arm|hair(less|y)|膚|手|指|腕|毛/i.test(t) && !/head|hair\b(?!less)/i.test(t)).join(', ') : '';
  const sex = cam && (/\b(1boy|male|man|boy)\b/i.test(cam.look) || /男/.test(cam.look) ? P.HAND_MAN : /\b(1girl|female|woman|girl)\b/i.test(cam.look) || /女/.test(cam.look) ? P.HAND_WOMAN : '');
  return [
    String(prompt).trim(),
    cam ? P.POV(cam.name, [sex, hand].filter(Boolean).join(P.COLON)) : '',
    notes.length ? `${P.PEOPLE_TITLE}\n${notes.join('\n')}` : '',
    // 玩家寫的風格蓋過上面的「photo」「realistic」：動漫風的卡寫 anime style 就要畫成動漫，不是寫實照片。
    // 玩家沒寫就用看頭像判斷的；判斷是寫實照片就不用加
    style && !/^realistic photo\.?$/i.test(style) ? P.STYLE(style) : '',
    ...people(inFrame.length),
    ...(realistic(style) ? photoLook(data.look.preset, inFrame.length > 0, anyRef) : []),
  ].filter(Boolean).join('\n');
}

// 寫實照片才加攝影手法和調色；玩家寫了動漫、插畫這類風格就不加（不然動漫圖會被要求拍成電影劇照）
const realistic = (style) => !style || /^realistic photo\.?$/i.test(style) || (/photo|film|realistic|寫實|照片|底片/i.test(style) && !/anime|manga|cartoon|illustrat|cel|3d|render|動漫|動畫|插畫|漫畫|卡通/i.test(style));

// 人入鏡時一定要的（精修、生活感、動漫都適用）：人體結構、各自的臉、衣服、互動不擺拍
function people(n) {
  if (!n) return [];
  return [P.ONLY_LISTED, P.NO_SELFIE, P.ANATOMY, P.CLOTHES, ...(n > 1 ? [P.TWO_PEOPLE] : [])];
}

/**
 * 照片質感，玩家在證件照頁二選一（look.preset）：
 *   polished 精修（預設）：10/14 跟露比對照 GPT 調出來的 E 版。Gemini 膚色常偏黃、背景太清楚、鏡頭太遠
 *   candid 生活感：露比給的長 prompt 濃縮的，像朋友用手機隨手拍、發在 SNS 上的照片
 * 文字都在 prompts.js
 */
function photoLook(preset, hasPeople, anyRef) {
  const hair = hasPeople ? P.HAIR : '';
  if (preset === 'candid') return [hair, P.CANDID.colour(anyRef), hasPeople ? P.CANDID.skin : '', hasPeople ? P.CANDID.gaze : '', P.CANDID.camera];
  return [hair, anyRef ? P.POLISHED.match : '', P.POLISHED.colour(anyRef), hasPeople ? P.POLISHED.people : P.POLISHED.things];
}

/**
 * 照片的「shot」：寫照片的模型同時寫一段給生圖用的畫面描述，入鏡的人列在 in。
 * 生圖照這兩個走，不再從一句話描述裡猜誰入鏡、是不是截圖、有沒有手（10/15 比比：一直補字眼補不完）
 */
export function shotRules(data, ch) {
  const names = [ch.name, ch.user, ...sideNames(data)].filter(Boolean);
  return [
    `- 每張照片另外寫 "shot"：給生圖模型看的畫面描述，用${P.SHOT_LANG}，逗號分隔，只寫看得到的東西，不寫心情、比喻、回憶：`,
    '  1. 先寫照片種類和鏡頭：誰用手機拍的（拍照的人自己拍的第一人稱／自拍／對鏡自拍／別人幫拍／偷拍），全身、半身、近景還是特寫，角度',
    '  2. 入鏡的每個人寫名字（照下面 in 的名單寫法，不用暱稱），加動作、表情、穿著；不寫臉、髮色、雀斑、年紀、身材（證件照會處理）；沒有人入鏡就明寫「畫面裡沒有人」',
    '  3. 拍照的人沒入鏡時，不要寫拍照的人的名字；只有手或手臂伸進畫面時，寫「拍照的人的手（男生的手／女生的手）」做什麼',
    '  4. 截圖、海報、插畫、存下來的圖片：寫「這是一張截圖（或圖片）本身，畫滿整張，沒有手機外框」，再寫圖上畫了什麼',
    '  5. 再寫地點、物件、光線、時間；不要寫畫面上要出現的字',
    `- 每張照片另外寫 "in"：入鏡的人（看得到臉或身體）的名字陣列，只能用這幾個名字：${names.join('、')}；路人不用列，只有手入鏡不算，沒有人就 []`,
  ].join('\n');
}
/** in 裡的名字換成證件照的 id（他、妳、配角） */
export function shotIds(data, ch, names) {
  const ids = [];
  for (const n of (Array.isArray(names) ? names : []).map((x) => String(x).trim()).filter(Boolean)) {
    const id = n === ch.name ? HIM : n === ch.user ? ME : sideNames(data).find((k) => k === n || (n.length >= 2 && k.includes(n)) || (k.length >= 2 && n.includes(k)));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
/** 玩家改過 shot：原本的 in 留著，新寫進去的名字（兩個字以上，避免「格」撞「風格」）加上 */
export function shotInAfterEdit(data, ch, text, old = []) {
  const names = [...(old || [])];
  for (const n of [ch.name, ch.user, ...sideNames(data)]) if (n && n.length >= 2 && text.includes(n) && !names.includes(n)) names.push(n);
  return names;
}
