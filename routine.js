// 他現實的作息：一張卡一份（照角色卡請模型寫一次，存起來，兩週更新一次）。
// 尋找 App 的現實模式照這個擺他在哪，不用等他在 LINE 傳位置；LINE 現實模式也讀得到，
// 所以他知道自己此刻人在哪，答的會跟地圖一致（10/19 比比：像女友用定位偷看男友在哪，角色自己也要讀得到）

import { generate } from './st.js';
import * as store from './store.js';
import * as data from './data.js';

const parseJSON = (t) => { const m = String(t).match(/\[[\s\S]*\]/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };
const mins = (hm) => { const [h, m] = String(hm).split(':').map(Number); return ((h || 0) * 60 + (m || 0)) % 1440; };

const making = new Map();
/** 這張卡的作息表：{ items: [{ days, from, to, place, doing }], ts }。沒有或太舊就請模型寫一份 */
export async function routineOf(ch, { force = false } = {}) {
  const key = ch.charKey || ch.key;
  const cur = await store.get('routine:' + key).catch(() => null);
  if (cur?.items?.length && !force && Date.now() - cur.ts < 14 * 864e5) return cur;
  if (making.has(key)) return making.get(key);
  const p = (async () => {
    try {
      const t = await generate([
        '[Brume Phone · 作息]',
        `現在不是在寫劇情正文。請照角色卡，寫出 ${ch.name} 現實生活裡平常一天的作息：平日一份、假日一份，各從起床到睡覺，合計 10 到 16 段。`,
        '每段寫：從幾點到幾點、人在哪、在做什麼。地點 8 字內、像地圖上的名字（家、公司、巷口咖啡店、健身房、河堤）；做什麼 12 字內。地點要照他的職業和個性，不要編跟角色卡不合的；同一個地方前後兩段用一樣的名字。',
        '只輸出 JSON 陣列：[{"days":"weekday","from":"07:30","to":"09:00","place":"家","doing":"賴床、煮咖啡"},{"days":"weekend",...}]',
      ].join('\n'));
      const items = (parseJSON(t) || []).filter((x) => x && x.from && x.to && x.place)
        .map((x) => ({ days: x.days === 'weekend' ? 'weekend' : 'weekday', from: String(x.from).slice(0, 5), to: String(x.to).slice(0, 5), place: String(x.place).trim().slice(0, 12), doing: String(x.doing || '').trim().slice(0, 20) }));
      if (!items.length) return cur || null;
      const r = { items, ts: Date.now() };
      await store.set('routine:' + key, r).catch(() => {});
      return r;
    } catch { return cur || null; } finally { making.delete(key); }
  })();
  making.set(key, p);
  return p;
}
export const dropRoutine = (ch) => store.set('routine:' + (ch.charKey || ch.key), null).catch(() => {});

const listFor = (r, d) => {
  const wk = d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : 'weekday';
  const list = r.items.filter((x) => x.days === wk);
  return (list.length ? list : r.items).slice().sort((a, b) => mins(a.from) - mins(b.from));
};
/** 現在（現實時間）作息表上他在哪一段 */
export function slotAt(r, d = new Date()) {
  if (!r?.items?.length) return null;
  const list = listFor(r, d); const now = d.getHours() * 60 + d.getMinutes();
  const hit = list.find((x) => { const a = mins(x.from); const b = mins(x.to); return b > a ? now >= a && now < b : now >= a || now < b; });
  if (hit) return hit;
  // 兩段之間的空檔：算在剛結束的那段（多半是在家）
  return list.filter((x) => mins(x.to) <= now).sort((a, b) => mins(b.to) - mins(a.to))[0] || list[list.length - 1];
}
/** 今天的整份（給地標），每段帶 ts＝今天那個時間 */
export function todayItems(r, d = new Date()) {
  if (!r?.items?.length) return [];
  const base = new Date(d); base.setHours(0, 0, 0, 0);
  return listFor(r, d).map((x) => ({ ...x, ts: base.getTime() + mins(x.from) * 60000 }));
}

/**
 * 現實時間他現在在哪：他最近（兩小時內）在 LINE 傳過位置就用那個，不然照作息表。
 * 回 { place, line, day, ts, auto }；auto＝作息表算的。沒有作息表、也沒傳過就 null
 */
export async function whereNow(ch) {
  const sent = await data.whereNow.get(ch.key).catch(() => null);
  if (sent && Date.now() - sent.ts < 2 * 36e5) return { ...sent, auto: false };
  const s = slotAt(await routineOf(ch));
  if (s) return { place: s.place, line: s.doing, day: data.today(), ts: Date.now(), auto: true };
  return sent ? { ...sent, auto: false } : null;
}
