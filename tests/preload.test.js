'use strict';
// اختبارات js/preload.js: طابور التحميل الخلفي، الترتيب، تخطي المحفوظ، والإيقاف/الاستئناف.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPreloadSandbox, makeFakeTimers } = require('./harness.js');

const numberFromUrl = (url) => Number(/\/surah\/(\d+)\//.exec(url)[1]);

// استجابة API مزيّفة بنفس شكل api.alquran.cloud (data.ayahs[].numberInSurah/text).
function apiResponse(count = 3) {
  const ayahs = Array.from({ length: count }, (_, i) => ({ numberInSurah: i + 1, text: 'آية ' + (i + 1) }));
  return { ok: true, text: async () => JSON.stringify({ data: { ayahs } }) };
}

// يترك microtasks الحلقة تكتمل (المؤقتات الفورية تُحل عبر microtask).
const drain = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

// يقدّم حلقة preload عند استخدام مؤقتات مزيّفة (تتوقف عند كل نوم) حتى ينفد الطابور.
async function runWithFakeTimers(timers, preloader, max = 1200) {
  let guard = 0;
  while (preloader.pendingCount() > 0 && guard++ < max) {
    timers.flush();
    await Promise.resolve();
    await Promise.resolve();
  }
}

test('start لا يبدأ بلا إنترنت', () => {
  const sb = createPreloadSandbox({ navigator: { onLine: false }, fetch: () => apiResponse() });
  sb.preloader.start(1);
  assert.equal(sb.preloader.pendingCount(), 0);
  assert.equal(sb.preloader.isRunning(), false);
  assert.equal(sb.fetchCalls.length, 0);
});

test('start يحترم وضع توفير البيانات', () => {
  const sb = createPreloadSandbox({ navigator: { connection: { saveData: true } }, fetch: () => apiResponse() });
  sb.preloader.start(1);
  assert.equal(sb.preloader.pendingCount(), 0);
  assert.equal(sb.fetchCalls.length, 0);
});

test('الترتيب: جوار الحالية ثم المقترحة ثم الترتيب، وكل سورة مرة واحدة', async () => {
  const order = [];
  const sb = createPreloadSandbox({
    fetch: (url) => { order.push(numberFromUrl(url)); return apiResponse(); },
  });
  sb.preloader.start(1);
  await drain();
  assert.deepEqual(order.slice(0, 6), [2, 18, 36, 56, 1, 3]); // جوار 1 ثم 18/36/56 ثم الباقي
  assert.equal(order.length, 114);
  assert.equal(new Set(order).size, 114); // بلا تكرار
  assert.equal(sb.preloader.pendingCount(), 0);
  assert.equal(sb.preloader.isRunning(), false);
  // الاكتمال يُعلَن بحدث أخير
  const last = sb.events[sb.events.length - 1];
  assert.deepEqual(last.detail, { cached: 114, total: 114 });
});

test('كل سورة تُحفظ في localStorage بنفس شكل الكاش', async () => {
  const sb = createPreloadSandbox({ fetch: () => apiResponse() });
  sb.preloader.start(1);
  await drain();
  const cached = JSON.parse(sb.localStorage.getItem('surah_cache_112'));
  assert.ok(Array.isArray(cached.ayahs));
  assert.deepEqual(cached.ayahs[0], { number: 1, text: 'آية 1' });
});

test('السور المحفوظة تُتخطى ولا تُجلب', async () => {
  const sb = createPreloadSandbox({
    storage: {
      surah_cache_1: JSON.stringify({ ayahs: [{ number: 1, text: 'x' }] }),
      surah_cache_2: JSON.stringify({ ayahs: [{ number: 1, text: 'x' }] }),
    },
    fetch: () => apiResponse(),
  });
  sb.preloader.start(1);
  await drain();
  assert.equal(sb.fetchCalls.some((u) => numberFromUrl(u) === 1), false);
  assert.equal(sb.fetchCalls.some((u) => numberFromUrl(u) === 2), false);
  assert.equal(sb.fetchCalls.length, 112);
});

test('dequeue يُخرج السورة من الطابور', () => {
  const sb = createPreloadSandbox({ fetch: () => new Promise(() => {}) }); // جلب معلّق يوقف الحلقة
  sb.preloader.start(1);
  assert.equal(sb.preloader.isRunning(), true);
  assert.equal(sb.preloader.pendingCount(), 114);
  sb.preloader.dequeue(50);
  assert.equal(sb.preloader.pendingCount(), 113);
  sb.preloader.dequeue(999); // غير موجود → لا تغيير
  assert.equal(sb.preloader.pendingCount(), 113);
});

test('start لا يبدأ مرتين', () => {
  const sb = createPreloadSandbox({ fetch: () => new Promise(() => {}), timers: makeFakeTimers() });
  sb.preloader.start(1);
  const before = sb.fetchCalls.length;
  sb.preloader.start(50);
  assert.equal(sb.fetchCalls.length, before);
  assert.equal(sb.preloader.pendingCount(), 114);
});

test('userActive يوقف الجلب مؤقتًا ثم يستأنف', async () => {
  const timers = makeFakeTimers();
  const sb = createPreloadSandbox({ fetch: () => apiResponse(), timers });
  sb.preloader.userActive(true);
  sb.preloader.start(1);
  assert.equal(sb.fetchCalls.length, 0); // متوقف أثناء جلب المستخدم
  assert.equal(sb.preloader.pendingCount(), 114);
  assert.equal(sb.preloader.isRunning(), true);
  sb.preloader.userActive(false);
  await runWithFakeTimers(timers, sb.preloader);
  assert.equal(sb.preloader.pendingCount(), 0);
  assert.equal(sb.fetchCalls.length, 114); // استأنف وأكمل
});

test('فشل الجلب يعيد السورة لآخر الطابور ثم تنجح', async () => {
  const attempts = {};
  const timers = makeFakeTimers();
  const sb = createPreloadSandbox({
    timers,
    fetch: (url) => {
      const n = numberFromUrl(url);
      attempts[n] = (attempts[n] || 0) + 1;
      if (n === 2 && attempts[n] === 1) return Promise.reject(new Error('offline'));
      return apiResponse();
    },
  });
  sb.preloader.start(1);
  await runWithFakeTimers(timers, sb.preloader);
  assert.equal(sb.preloader.pendingCount(), 0);
  assert.ok(attempts[2] >= 2, 'أُعيدت محاولة السورة الفاشلة');
});
