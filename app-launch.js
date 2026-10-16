// 從桌面的「霧語」圖示打開時：直接進酒館，霧語會自己挑上次的角色、打開手機（index.js 看 bp-app）
// 在瀏覽器裡打開時：照手機種類顯示「加到主畫面」的步驟；網址帶 ?icon= 就把桌面圖示換成玩家自己的照片
(function () {
  var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (standalone) { location.replace('/?bp-app=1'); return; }
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  document.getElementById(ios ? 'ios' : android ? 'android' : 'other').classList.remove('hide');

  var icon = new URL(location.href).searchParams.get('icon');
  if (!icon || !/^\/[^/]/.test(icon)) return; // 只吃這個酒館自己的圖片
  var img = new Image();
  img.onload = function () {
    // 圖示直接做成 data 網址：加到桌面時手機不一定帶得上酒館的登入，連網址抓圖會抓不到
    function draw(n) { var c = document.createElement('canvas'); c.width = c.height = n; var s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n); return c.toDataURL('image/png'); }
    var d180 = draw(180); var d192 = draw(192); var d512 = draw(512);
    document.querySelector('link[rel="apple-touch-icon"]').href = d180;
    document.querySelector('main img').src = d180;
    var manifest = {
      name: '霧語', short_name: '霧語', start_url: location.origin + '/?bp-app=1', scope: location.origin + '/',
      display: 'standalone', background_color: '#68747f', theme_color: '#000000',
      icons: [{ src: d192, sizes: '192x192', type: 'image/png' }, { src: d512, sizes: '512x512', type: 'image/png' }],
    };
    var link = document.querySelector('link[rel="manifest"]');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
  };
  img.src = icon;
})();
