// 升版：npm run bump 0.25.20
// 版本號寫在兩個地方，一定要一起改（10/23：0.25.19 只改了 manifest，index.js 沒改，體檢誤報）：
//   manifest.json 的 version：酒館擴充管理、「有新版」提醒看的
//   index.js 的 VERSION：寫死在程式裡，體檢靠它判斷手上跑的程式是不是最新的（不能改成去讀 manifest，iPhone 快取會騙過它）
// app-launch.js 的 SHELL_VERSION 是門面自己的版本，只有改到 app.html／app-launch.js 才動，這支不碰。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const next = process.argv[2] || '';
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error('用法：npm run bump 0.25.20');
  process.exit(1);
}

const mPath = root + 'manifest.json';
const iPath = root + 'index.js';
const manifest = readFileSync(mPath, 'utf8');
const index = readFileSync(iPath, 'utf8');
const mRe = /("version":\s*")(\d+\.\d+\.\d+)(")/;
const iRe = /(const VERSION = ')(\d+\.\d+\.\d+)(';)/;
const was = [manifest.match(mRe)?.[2], index.match(iRe)?.[2]];
if (!was[0] || !was[1]) {
  console.error('找不到版本號：manifest.json 要有 "version"，index.js 要有 const VERSION = \'x.y.z\';');
  process.exit(1);
}
writeFileSync(mPath, manifest.replace(mRe, `$1${next}$3`));
writeFileSync(iPath, index.replace(iRe, `$1${next}$3`));
console.log(`manifest.json ${was[0]} → ${next}`);
console.log(`index.js      ${was[1]} → ${next}`);
if (was[0] !== was[1]) console.log('（升版前兩邊本來就不一樣，現在對齊了）');
