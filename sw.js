// عامل الخدمة لتطبيق نور — يخزّن هيكل التطبيق ليعمل دون إنترنت ويجعله قابلًا للتثبيت (PWA).
// لا يمس حالة الختمة (localStorage) ولا مصدر نص السور — مجرد نسخة من الملفات نفسها.
// غيّر رقم النسخة عند تغيير أي ملف أساسي حتى يستبدل المستخدمون النسخة القديمة.
const SW_CACHE = 'noor-v1';

// الملفات الأساسية: مسارات نسبية لتعمل تحت /quran-app/ على GitHub Pages كما محليًا.
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/preload.js',
  './js/offline-surahs.js',
  './data/surahs.json',
  './data/daily.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/logo/favicon.svg',
];

// التثبيت: خزّن الهيكل كاملًا ثم فعّل فورًا دون انتظار إغلاق التبويب.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SW_CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

// التفعيل: احذف أي نسخة قديمة من الكاش ثم تولّ المسؤولية عن الصفحات المفتوحة.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SW_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// الجلب: نفس الأصل (ملفات التطبيق) من الكاش أولًا — والباقي (API والخطوط) من الشبكة أولًا مع سقوط للكاش.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  if (sameOrigin) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            caches.open(SW_CACHE).then((cache) => cache.put(event.request, copy));
            return response;
          }),
      ),
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SW_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
  }
});
