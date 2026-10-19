// 真的天氣：玩家在設定填一次城市，LINE 在現實時間的時候，鎖定畫面顯示那裡現在的天氣、他也讀得到。
// 走 open-meteo（免費、不用鑰匙、不記玩家）。故事時間的天氣另一份，是正文 <phone> 報的（data.weather）。
// 10/19 比比要的：天氣直接做在鎖定畫面，不另外開 App。

import { ctx } from './st.js';

const KEY = 'brume-phone:realwx';
// WMO 天氣代碼 → 中文
const CODES = [[[0], '晴'], [[1], '大致晴'], [[2], '多雲'], [[3], '陰'], [[45, 48], '霧'], [[51, 53, 55, 56, 57], '毛毛雨'], [[61, 63, 65, 66, 67, 80, 81, 82], '雨'], [[71, 73, 75, 77, 85, 86], '雪'], [[95, 96, 99], '雷雨']];
const skyOf = (code) => (CODES.find(([cs]) => cs.includes(Number(code))) || [0, '多雲'])[1];

// 城市存在酒館的擴充設定（手機電腦同一份）
function root() { const c = ctx(); return c?.extensionSettings ? (c.extensionSettings['brume-phone'] ||= {}) : null; }
export const city = {
  get: () => String(root()?.realCity || '').trim(),
  set(v) { const r = root(); if (r) { r.realCity = String(v || '').trim(); ctx()?.saveSettingsDebounced?.(); } cache = null; try { localStorage.removeItem(KEY); } catch { /* 無痕 */ } },
};

let cache = null; try { cache = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { cache = null; }
let inflight = null;

// 城市 → 經緯度。台灣的縣市先查內建表（open-meteo 的地名庫認不得「台中」「台南」，「高雄」會給四川的）；
// 其他交給 OpenStreetMap 的 Nominatim（中文地名都認得），中文查詢優先挑台灣的結果；最後才退回 open-meteo 的地名庫
const TW = { 台北: [25.04, 121.56], 新北: [25.01, 121.46], 桃園: [24.99, 121.30], 台中: [24.15, 120.67], 台南: [22.99, 120.21], 高雄: [22.63, 120.30], 基隆: [25.13, 121.74], 新竹: [24.80, 120.97], 苗栗: [24.56, 120.82], 彰化: [24.08, 120.54], 南投: [23.91, 120.68], 雲林: [23.71, 120.43], 嘉義: [23.48, 120.45], 屏東: [22.68, 120.49], 宜蘭: [24.76, 121.75], 花蓮: [23.99, 121.60], 台東: [22.76, 121.14], 澎湖: [23.57, 119.58], 金門: [24.44, 118.32], 馬祖: [26.16, 119.95] };
function geoLocal(name) {
  const k = name.replace(/臺/g, '台').replace(/[市縣]$/, '');
  return TW[k] ? { name: k, lat: TW[k][0], lon: TW[k][1] } : null;
}
async function geoNominatim(name) {
  const list = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&limit=5&accept-language=zh-TW`).then((r) => r.json());
  if (!Array.isArray(list) || !list.length) return null;
  const pick = (/[\u4e00-\u9fff]/.test(name) && list.find((x) => /臺灣|台灣/.test(x.display_name || ''))) || list[0];
  const label = String(pick.display_name || '').split(',')[0].split(/[;／/]/).pop().trim() || name;
  return { name: label, lat: +pick.lat, lon: +pick.lon };
}
async function geoOpenMeteo(name) {
  const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=zh&format=json`).then((r) => r.json());
  const list = g?.results || []; if (!list.length) return null;
  const p = list.find((x) => x.country_code === 'TW') || list[0];
  return { name: p.name || name, lat: p.latitude, lon: p.longitude };
}
async function geocode(name) {
  return geoLocal(name) || (await geoNominatim(name).catch(() => null)) || (await geoOpenMeteo(name).catch(() => null));
}

async function refresh(name) {
  // 同一個城市的經緯度查過就留著，三十分鐘一次只打天氣那支
  const p = (cache && cache.city === name && cache.lat != null) ? { name: cache.place, lat: cache.lat, lon: cache.lon } : await geocode(name);
  if (!p) throw new Error(`找不到「${name}」，換個寫法試試（例如 台北、文山區、Tokyo）`);
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code&timezone=auto`).then((r) => r.json());
  const cur = w?.current || {};
  if (cur.temperature_2m == null) throw new Error('天氣讀不到，等一下再試');
  cache = { city: name, place: p.name || name, lat: p.lat, lon: p.lon, temp: Math.round(cur.temperature_2m), sky: skyOf(cur.weather_code), ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 無痕 */ }
  return cache;
}

/** 現在的真天氣 { city, place, temp, sky, ts }；沒填城市回 null。超過 30 分鐘就重抓；抓不到但有舊的就先給舊的 */
export async function get({ force = false } = {}) {
  const name = city.get();
  if (!name) return null;
  const have = cache && cache.city === name;
  if (have && !force && Date.now() - cache.ts < 30 * 60000) return cache;
  if (!inflight) inflight = refresh(name).finally(() => { inflight = null; });
  if (have && !force) { inflight.catch(() => {}); return cache; }
  return inflight;
}
