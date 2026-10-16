# 霧語推播：酒館關著也收得到他的 LINE

開了推播之後，他會挑妳沒在玩的時候傳 LINE，手機鎖著也會跳通知，點通知就回到酒館的 LINE。

## 誰用得到

| 酒館架在哪 | 收得到嗎 |
|---|---|
| 雲端，有 https 網址（Railway、Zeabur、自己的主機） | ✅ |
| 安卓手機上用 Termux 跑、同一支手機開 | ✅（Termux 要保持在背景開著） |
| 裝在家裡電腦，手機用 http 連進去 | ❌ 手機規定要 https 才能收通知 |
| 只在電腦上玩 | ⚠️ 瀏覽器開著才收得到 |

## 安裝（伺服器那邊，只要做一次）

酒館的設定要打開「伺服器外掛」，再把霧語放進 `plugins` 資料夾。

### Railway、Zeabur 這類雲端平台（官方 Docker 映像）

1. 到服務的 **Variables（環境變數）** 加一行：
   ```
   SILLYTAVERN_ENABLESERVERPLUGINS=true
   ```
2. 到 **Settings → Start Command（啟動指令）** 貼這一行：
   ```
   sh -c "git clone --depth 1 https://github.com/lubiyu0307-prog/brume-phone plugins/brume-phone 2>/dev/null || git -C plugins/brume-phone pull --ff-only; exec ./docker-entrypoint.sh"
   ```
3. 重新部署。

### 裝在自己電腦或 Termux

在酒館的資料夾裡：
```
git clone https://github.com/lubiyu0307-prog/brume-phone plugins/brume-phone
```
再把 `config.yaml` 裡的 `enableServerPlugins: false` 改成 `true`，重新啟動酒館。

看到啟動紀錄有「霧語推播外掛啟動」就是裝好了。

## 開啟通知（每支手機各按一次）

霧語 → 設定 →「開啟通知」，跳出來的視窗選「允許」，馬上會收到一則測試通知。

- **iPhone**：要 iOS 16.4 以上，而且要先把酒館「加入主畫面」，從主畫面的圖示打開再按。
- **安卓**：用 Chrome。小米、OPPO、華為這些手機請到「設定 → 電池」把 Chrome 設成「不受限制」，通知才不會晚到。
- **電腦**：瀏覽器開著才收得到。

按鈕下面會寫還差哪一步，照著做就好。

## 會不會亂花錢、半夜吵人

- 訊息照什麼時間寫可以選：「照劇情」照故事裡現在幾點寫；「照現實」照妳收到通知的那一刻寫（早上收到早安、晚上問妳到家了沒）。
- 他一天最多傳幾次、幾點到幾點不傳，設定頁都可以選（預設一天 3 次、凌晨 1 點到早上 9 點不傳）。
- 排好的都送完、妳又一整天沒打開的話，他會從事先寫好的幾句備用短訊挑一句傳，一天最多一句，不會整個消失。
- 每次打開酒館會順手檢查通知的訂閱還在不在，伺服器重新部署、iPhone 自己清掉訂閱都會自動接回來。
- 訊息是妳停下來沒在玩的時候先寫好的，用的是妳原本的 API；妳一回話或劇情一動，還沒送的就作廢。
- 伺服器外掛本身不叫模型、不碰金鑰，只負責到點送出。推播從妳的酒館直接送到妳的手機，不經過任何第三方伺服器。
- 某張卡設成「不用小手機」就不會傳。
