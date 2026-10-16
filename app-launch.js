// 從桌面的「霧語」圖示打開時：直接進酒館，霧語會自己挑上次的角色、打開手機（index.js 看 bp-app）
// 在瀏覽器裡打開時：照手機種類顯示「加到主畫面」的步驟
(function () {
  var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (standalone) { location.replace('/?bp-app=1'); return; }
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  document.getElementById(ios ? 'ios' : android ? 'android' : 'other').classList.remove('hide');
})();
