// عامل الخدمة لتطبيق نور — يخزّن هيكل التطبيق ليعمل دون إنترنت ويجعله قابلًا للتثبيت (PWA).
// لا يمس حالة الختمة (localStorage) ولا مصدر نص السور — مجرد نسخة من الملفات نفسها.
// رقم النسخة مشتق من NOOR_VERSION في js/version.js — مصدر واحد يرفعه مع كل تغيير أساسي.
importScripts('./js/version.js');
const SW_CACHE = 'noor-v' + NOOR_VERSION;

// الملفات الحرجة للإقلاع الأول تُخزّن لحظة التثبيت — والباقي (الهوية والأيقونات) يُخزّن كسولًا عند أول طلب عبر معالج fetch أدناه، حتى لا يزاحم أول رسم.
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/version.js',
  './js/app.js',
  './js/preload.js',
  './js/offline-surahs.js',
  './data/surahs.json',
  './data/daily.json',
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

// الجلب: ملفات التطبيق (نفس الأصل) من الشبكة أولًا مع سقوط للكاش — التحديث يصل فور اتصال دون اعتماد على رفع النسخة.
// الخطوط (خارج الأصل) من الكاش أولًا — بصمتها ثابتة في روابط Google Fonts، ونسخة واحدة تكفي وتوفر باقة المستخدم.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  if (sameOrigin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SW_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request)
            .then((response) => {
              const copy = response.clone();
              caches.open(SW_CACHE).then((cache) => cache.put(event.request, copy));
              return response;
            }),
      ),
    );
  }
});
