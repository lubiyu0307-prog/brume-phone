# 交接：把「霧語推播站」架上 Railway

給比比 Mac 上的終端機格。雲端格 2026-10-16 寫的。

## 要做的事

把 `brume-phone` 的 `server/relay.mjs` 架成 Railway 上一個**新的服務**，拿到網址後填進霧語、推上 main。
推播站沒有任何外部套件，`npm start` 就是 `node server/relay.mjs`。

## 先確認

- **營業時間不要動**（週四 16–19、週五 14–19、週六 14–18、週日 14–17）。
- **不要在 njfw 資料夾裡跑 `railway`**：njfw 連結的是酒館 `lubi-sillytavern`，10/7 推錯過一次。
- 這次是**新增一個服務**，不要動到 `lubi-sillytavern`、SSK、mill、brume、格的容器。

## 步驟

1. 拿到最新的 brume-phone，進它的資料夾：
   ```
   cd ~/src && (git -C brume-phone pull || git clone https://github.com/lubiyu0307-prog/brume-phone) && cd brume-phone
   ```
2. 先在本機確認推播站能跑：
   ```
   npm test
   ```
   最後一行要是「全部通過」。
3. 連到比比的 Railway 專案（Lulubibi 那個，跟酒館同一個），然後**新增一個服務**，名字叫 `wuyu-push`，來源選 GitHub 的 `lubiyu0307-prog/brume-phone`、`main` 分支。
   - CLI 做得到就用 CLI（`railway link` 選專案，再 `railway add` 新增服務）；
   - CLI 卡住就請比比在網頁上點：專案 → **New → GitHub Repo → brume-phone**。
   - **不要用 `railway up` 推到現有的服務**。
4. 給 `wuyu-push` 加一顆磁碟，掛在 `/data`（`railway volume add`，或網頁 Settings → Volumes）。
   沒掛的話，每次重新部署推播鑰匙都會換掉，大家的通知會斷。
5. 產生網址：`railway domain`（或網頁 Settings → Networking → Generate Domain）。
6. 確認推播站活著：
   ```
   curl https://<網址>/
   ```
   要看到 `{"ok":true,"name":"霧語推播站"}`。Railway 的紀錄裡也會有「霧語推播站 listening」。
7. 把網址填進 `push.js` 的 `DEFAULT_RELAY`（不要結尾的 `/`），版本號 +1：
   `index.js` 的 `VERSION` 和 `manifest.json` 的 `version` 一起改。
   檢查語法：`node --input-type=module --check < push.js`
8. commit 推上 brume-phone 的 `main`。

## 做完之後跟比比說

- 酒館重新整理（霧語會自己更新），從**主畫面**打開酒館 → 霧語 → 設定 →「開啟通知」→ 允許。
- 幾秒內應該會收到「通知打開了」的測試通知。
- 收不到的話：霧語設定 →「複製除錯紀錄」，連同 Railway `wuyu-push` 的紀錄給格看。

## 背景（看不懂時參考）

- 推播站只收：推播訂閱、角色名、霧語預先寫好的訊息、排定時間、安靜時段。不收 API 金鑰、聊天內容。
- 每個霧語第一次連線時自己產生一組 id＋key，推播站只存 key 的雜湊。
- 說明全文在 `PUSH.md`。
