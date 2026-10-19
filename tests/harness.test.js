'use strict';
// اختبار سلامة الحزمة نفسها: يتحقق أن الـ sandbox يحمّل الملفات ويكشف الواجهات المتوقعة.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppSandbox, createPreloadSandbox } = require('./harness.js');

test('sandbox التطبيق يكشف الدوال والثوابت ويحمّل فهرس السور', () => {
  const app = createAppSandbox();
  assert.equal(typeof app.hooks.parseProgressFile, 'function');
  assert.equal(typeof app.hooks.normalizeArabic, 'function');
  assert.equal(typeof app.hooks.collectProgress, 'function');
  assert.equal(app.hooks.PROGRESS_FORMAT, 2);
  assert.equal(app.hooks.APP_VERSION, '1.0.0');
  assert.equal(app.hooks.TOTAL_AYAS, 6236);
  assert.equal(app.hooks.getSurahs().length, 114); // الفهرس الحقيقي محمّل
  assert.deepEqual(app.hooks.getState(), app.hooks.defaultState()); // حالة نظيفة
});

test('sandbox preload يفوّض window.SurahPreloader بواجهته الكاملة', () => {
  const sb = createPreloadSandbox();
  assert.ok(sb.preloader, 'window.SurahPreloader معرّف');
  ['start', 'userActive', 'dequeue', 'pendingCount', 'isRunning'].forEach((name) => {
    assert.equal(typeof sb.preloader[name], 'function', name);
  });
});
