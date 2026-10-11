// SH-CONTACT service worker — แคชเฉพาะ app shell และไลบรารี CDN
// ข้อมูล Firebase (Database / Auth) ไม่ผ่านแคช เพื่อให้ข้อมูลสดและล็อกอินทำงานถูกต้อง
const CACHE = 'sh-contact-v1';
const PRECACHE = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(url) {
  if (url.origin === self.location.origin) return true;
  if (url.hostname === 'cdn.jsdelivr.net') return true;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return true;
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) return true;
  return false; // firebaseio, identitytoolkit, securetoken, accounts.google.com ฯลฯ ผ่านตรง
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  if (url.origin === self.location.origin && url.pathname.startsWith('/__/')) return; // Firebase auth handler

  // หน้าเว็บ: ลองเน็ตก่อน ถ้าออฟไลน์ใช้ของในแคช
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // ไฟล์อื่น: ใช้แคชก่อนแล้วอัปเดตเบื้องหลัง
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
