// 從桌面的「霧語」圖示打開時：這一頁自己當門面——先蓋開機畫面（玩家自己的照片和字），
// 酒館在後面那層（同網域的 iframe）偷偷載，霧語在裡面醒來、手機開好了，才把照片收掉。
// 玩家從頭到尾只看到霧語，看不到酒館的載入圖。（10/17 比比要的：讓霧語半獨立出來）
// 在瀏覽器裡打開時：照手機種類顯示「加到主畫面」的步驟；網址帶 ?icon= 就把桌面圖示換成玩家自己的照片
(function () {
  var SHELL_VERSION = '0.21.0'; // 跟 manifest.json 一起改；寫進除錯紀錄，才看得出手機跑的是不是最新的門面
  window.BP_SHELL_VERSION = SHELL_VERSION; // 裡面的霧語會來對：對不上就把這一頁換個網址重載，繞過 iPhone 的快取
  var SHELL_CSS = "  /* 從桌面圖示打開時：這一頁自己當門面。先蓋開機畫面，酒館在後面那層偷偷載，手機開好了照片才退場 */\n  body.shell { display: block; overflow: hidden; height: 100%; min-height: 0; }\n  body.shell main { display: none; }\n  #bp-shell { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; background: #0b0b0c; }\n  /* iframe 裡拿不到 env(safe-area-inset-*)：底下 home 橫條那一條由這一頁留出來，不然手機底部會被壓在橫條下面 */\n  #bp-shell[hidden] { display: none; }\n  #bp-shell-frame { position: absolute; top: 0; left: 0; width: 100%; height: calc(100% - env(safe-area-inset-bottom, 0px)); border: 0; display: block; background: #687484; opacity: 0; transition: opacity .5s ease; }\n  #bp-shell.ready #bp-shell-frame { opacity: 1; }\n  #bp-shell-splash {\n    position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center;\n    background: linear-gradient(180deg, #687484 0%, #8d95a0 45%, #cec5b8 100%);\n    background-image: var(--bp-splash-bg, none), linear-gradient(180deg, #687484 0%, #8d95a0 45%, #cec5b8 100%);\n    background-size: cover; background-position: center;\n    opacity: 1; transition: opacity .7s ease; overflow: hidden; color: #fff;\n    font-family: Georgia, \"Times New Roman\", \"Noto Serif TC\", \"Songti TC\", serif;\n  }\n  #bp-shell.ready #bp-shell-splash { opacity: 0; pointer-events: none; }\n  #bp-shell-splash.has-bg::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, rgba(20, 24, 32, .15) 0%, rgba(20, 24, 32, .05) 40%, rgba(20, 24, 32, .55) 100%); }\n  #bp-shell-splash .mist {\n    position: absolute; left: -30%; right: -30%; bottom: -10%; height: 55%;\n    background: radial-gradient(ellipse at 30% 60%, rgba(255, 255, 255, .55), transparent 60%), radial-gradient(ellipse at 75% 75%, rgba(255, 255, 255, .45), transparent 55%);\n    filter: blur(18px); animation: bp-mist 9s ease-in-out infinite alternate;\n  }\n  #bp-shell-splash.has-bg .mist { opacity: .45; }\n  @keyframes bp-mist { from { transform: translateX(-6%); } to { transform: translateX(6%); } }\n  #bp-shell-splash .txt { position: relative; text-align: center; transform: translateY(-6vh); }\n  #bp-shell-splash .txt b { display: block; font-weight: 400; font-size: clamp(44px, 14vw, 72px); letter-spacing: .04em; text-shadow: 0 2px 18px rgba(30, 34, 44, .35); }\n  #bp-shell-splash .txt span { display: block; margin-top: 8px; font-size: 16px; letter-spacing: .3em; opacity: .9; text-shadow: 0 1px 8px rgba(30, 34, 44, .4); }\n  #bp-shell-splash .dots { position: absolute; bottom: calc(48px + env(safe-area-inset-bottom)); display: flex; gap: 8px; }\n  #bp-shell-splash .dots u { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, .85); animation: bp-sdot 1.2s ease-in-out infinite; }\n  #bp-shell-splash .dots u:nth-child(2) { animation-delay: .2s; }\n  #bp-shell-splash .dots u:nth-child(3) { animation-delay: .4s; }\n  @keyframes bp-sdot { 0%, 100% { opacity: .25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }\n  #bp-shell-splash:not(.has-bg) .dots u { background: rgba(70, 78, 92, .55); }\n";
  var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var here = new URL(location.href);
  if (standalone || here.searchParams.has('shell')) { shell(); return; }
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  document.getElementById(ios ? 'ios' : android ? 'android' : 'other').classList.remove('hide');

  var icon = here.searchParams.get('icon');
  if (!icon || !/^\/[^/]/.test(icon)) return; // 只吃這個酒館自己的圖片
  var img = new Image();
  img.onload = function () {
    // 圖示直接做成 data 網址：加到桌面時手機不一定帶得上酒館的登入，連網址抓圖會抓不到
    function draw(n) { var c = document.createElement('canvas'); c.width = c.height = n; var s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n); return c.toDataURL('image/png'); }
    var d180 = draw(180); var d192 = draw(192); var d512 = draw(512);
    document.querySelector('link[rel="apple-touch-icon"]').href = d180;
    document.querySelector('main img').src = d180;
    var manifest = {
      name: 'Brume', short_name: 'Brume', start_url: location.origin + location.pathname, scope: location.origin + '/',
      display: 'standalone', background_color: '#687484', theme_color: '#687484',
      icons: [{ src: d192, sizes: '192x192', type: 'image/png' }, { src: d512, sizes: '512x512', type: 'image/png' }],
    };
    var link = document.querySelector('link[rel="manifest"]');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
  };
  img.src = icon;

  function shell() {
    var st = document.createElement('style'); st.textContent = SHELL_CSS; document.head.appendChild(st);
    document.body.classList.add('shell');
    var sh = document.getElementById('bp-shell'); sh.hidden = false;
    var sp = document.getElementById('bp-shell-splash');
    var fr = document.getElementById('bp-shell-frame');

    // 開機畫面的照片和字：霧語存在這個網域的 localStorage，這一頁讀得到；霧語醒來後還會再送一次最新的
    function applyConf(conf) {
      if (!conf) return;
      if (conf.bg) { sp.style.setProperty('--bp-splash-bg', 'url("' + String(conf.bg).replace(/"/g, '%22') + '")'); sp.classList.add('has-bg'); }
      sp.querySelector('.txt b').textContent = conf.title || 'Brume';
      sp.querySelector('.txt span').textContent = conf.line || '霧語';
    }
    var conf = {}; try { conf = JSON.parse(localStorage.getItem('brume-phone:splash') || '{}'); } catch (e) { /* 讀不到就用預設 */ }
    applyConf(conf);

    // 大小跟著看得到的範圍走（iPhone 彈鍵盤時 visualViewport 會變矮，酒館那層要跟著縮，手機才不會被鍵盤蓋住）
    // 10/17 比比打字時整個手機不見只剩底色，0.20.0 照 pageTop−scrollY 搬、0.20.1 釘在 0、0.20.2 照 offsetTop 搬都還是不見。
    // 10/18 她的截圖：鍵盤上面只剩這一頁 body 的漸層（而且是漸層的下半段），也就是整頁被 iOS 往下推去找輸入框，外殼跟著被推出畫面。
    // 0.20.3 不猜位置了：<html> 釘死（手機版酒館也是這樣擋 iOS 捲頁的）、每次畫面一動就先把頁面捲回最上面，
    // 外殼永遠在 0、只把高度縮成看得到的那段；酒館那層跟著縮，輸入框落在看得到的範圍裡，iOS 就沒理由再推。
    // 每次量到的數字一起寫進霧語的除錯紀錄（同一個 localStorage），設定裡「複製除錯紀錄」會帶出來給格看
    document.documentElement.style.cssText += ';position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden';
    var lastDbg = {};
    function shellDbg(tag) {
      try {
        var now = Date.now(); if (lastDbg[tag] && now - lastDbg[tag] < 150) return; lastDbg[tag] = now; // 捲動事件一秒好幾十次，同一種留一筆就好
        var vv = window.visualViewport; var b = sh.getBoundingClientRect(); var se = document.scrollingElement || document.documentElement;
        var row = { t: new Date().toTimeString().slice(0, 8), tag: 'shell-' + tag, sv: SHELL_VERSION, vv: vv ? [Math.round(vv.width), Math.round(vv.height), Math.round(vv.offsetTop), Math.round(vv.pageTop || 0)] : null, win: [innerWidth, innerHeight, Math.round(scrollY)], sh: [Math.round(b.top), Math.round(b.height)], doc: [Math.round(se.scrollTop), se.scrollHeight, document.body.scrollHeight], html: getComputedStyle(document.documentElement).position };
        var a = JSON.parse(localStorage.getItem('brume-phone:dbg') || '[]'); a.push(row); localStorage.setItem('brume-phone:dbg', JSON.stringify(a.slice(-80)));
      } catch (e) { /* 記不了就算了 */ }
    }
    function unscroll() {
      var vv = window.visualViewport;
      try { if (scrollY || (vv && (vv.pageTop || vv.offsetTop))) window.scrollTo(0, 0); } catch (e) { /* 捲不動就算了 */ }
      try { var se = document.scrollingElement; if (se && se.scrollTop) se.scrollTop = 0; } catch (e) { /* 同上 */ }
    }
    var fullH = 0; // 沒鍵盤時的整頁高度：iOS 18 彈鍵盤時 innerHeight 有時會跟著縮（10/18 的紀錄一下 793 一下 389），不能拿它當基準
    function fit(why) {
      unscroll();
      var vv = window.visualViewport;
      var W = Math.round(vv ? vv.width : innerWidth); var H = Math.round(vv ? vv.height : innerHeight);
      fullH = Math.max(fullH, innerHeight, H);
      sh.style.width = W + 'px'; sh.style.height = H + 'px'; sh.style.top = '0px'; sh.style.left = '0px';
      // 鍵盤彈出來的時候，底下 home 橫條那一條不在畫面裡了，酒館那層不用再讓它（10/18 輸入框跟鍵盤之間多一條黑的）
      fr.style.height = (H < fullH - 120) ? '100%' : '';
      if (why) { shellDbg(why); setTimeout(function () { shellDbg(why + '+400'); }, 400); }
    }
    // 鍵盤的動畫大約三百毫秒，visualViewport 的事件有時只在最後來一次：多量幾次，把中間被推走的那段也拉回來
    function refit(why) { fit(why); [60, 160, 320, 600].forEach(function (ms) { setTimeout(function () { fit(); }, ms); }); }
    fit();
    if (window.visualViewport) { visualViewport.addEventListener('resize', function () { refit('vv-resize'); }); visualViewport.addEventListener('scroll', function () { fit('vv-scroll'); }); }
    addEventListener('resize', function () { refit('resize'); });
    addEventListener('scroll', function () { fit('scroll'); });
    // 酒館跟這一頁同網域，裡面哪個輸入框被點到、鍵盤收掉，這裡都聽得到：不等 iOS 推完才反應
    function hookFrame() {
      try {
        var d = fr.contentWindow.document;
        d.addEventListener('focusin', function () { refit('focusin'); }, true);
        d.addEventListener('focusout', function () { setTimeout(function () { refit('focusout'); }, 50); }, true);
      } catch (e) { /* 跨網域就算了 */ }
    }

    var revealed = false; var shownAt = Date.now();
    function reveal() { if (revealed) return; revealed = true; sh.classList.add('ready'); }
    // 手機開好了：照片至少留 2.5 秒再退場，不要只閃一下
    function ready() { setTimeout(reveal, Math.max(0, 2500 - (Date.now() - shownAt))); }

    addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === 'bp-splash') applyConf(e.data.conf);
      if (e.data.type === 'bp-ready') ready();
    });
    // 酒館要登入的時候，照片得讓開，不然她看不到登入框
    fr.addEventListener('load', function () {
      hookFrame();
      try { if (/login/i.test(fr.contentWindow.location.pathname)) reveal(); } catch (e) { /* 跨網域讀不到就算了 */ }
    });
    // 通知小幫手傳話（點通知時酒館已經開著）：小幫手找到的可能是這一頁，轉給裡面的霧語
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) { try { fr.contentWindow.postMessage(e.data, location.origin); } catch (err) { /* 裡面還沒好 */ } });
    setTimeout(reveal, 40000); // 萬一霧語一直沒醒（擴充被關掉之類），四十秒後還是讓她看到酒館

    var u = new URL('/', location.origin);
    u.searchParams.set('bp-app', '1'); u.searchParams.set('bp-shell', '1');
    var open = here.searchParams.get('bp-open'); if (open) u.searchParams.set('bp-open', open); // 點通知進來的，帶給裡面
    fr.src = u.href;
  }
})();
