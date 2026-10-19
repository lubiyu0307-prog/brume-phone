// 霧語的通知小幫手（service worker）：酒館關著也醒著，收到推播就跳通知，點通知打開酒館的 LINE。
// 範圍只有擴充自己的資料夾，不會攔酒館的任何網頁請求。

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  // 桌面圖示右上角的紅色數字（iPhone 16.4 以上的主畫面 App、安卓 Chrome 都吃）
  if (d.badge && self.navigator.setAppBadge) self.navigator.setAppBadge(d.badge).catch(() => {});
  e.waitUntil(self.registration.showNotification(d.title || '霧語', {
    body: d.body || '',
    tag: d.tag || 'bp',
    renotify: true,
    data: { url: d.url || '/', chat: d.chat || '' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin);
  url.searchParams.set('bp-open', 'line');
  const chat = String(e.notification.data?.chat || ''); if (chat) url.searchParams.set('bp-chat', chat); // 10/19 比比：點格的通知跳到侯愷——帶著是哪個聊天傳的
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = list.find((c) => new URL(c.url).origin === self.location.origin);
    if (tab) { tab.postMessage({ type: 'bp-open', app: 'line', chat }); return tab.focus(); }
    return self.clients.openWindow(url.href);
  })());
});
