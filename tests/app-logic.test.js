'use strict';
// اختبارات المنطق النقي في js/app.js: التاريخ، تطبيع البحث، البسملة، وحالة الختمة.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppSandbox } = require('./harness.js');

const fresh = (opts) => createAppSandbox(opts);
const approx = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg || `${a} != ${b}`);

// ===== أدوات التاريخ والوقت =====
test('pad2 يضيف صفرًا بادئًا حتى منزلتين', () => {
  const { hooks } = fresh();
  assert.equal(hooks.pad2(0), '00');
  assert.equal(hooks.pad2(7), '07');
  assert.equal(hooks.pad2(12), '12');
  assert.equal(hooks.pad2(123), '123'); // لا يقصّ ما زاد
});

test('dateKeyOf يعطي YYYY-MM-DD بالتوقيت المحلي', () => {
  const { hooks } = fresh();
  assert.equal(hooks.dateKeyOf(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(hooks.dateKeyOf(new Date(2026, 11, 31)), '2026-12-31');
});

test('todayKey يطابق تاريخ اليوم المحلي', () => {
  const { hooks } = fresh();
  assert.equal(hooks.todayKey(), hooks.dateKeyOf(new Date()));
});

test('localStamp بساعة 24 بلا صباح/مساء', () => {
  const { hooks } = fresh();
  assert.equal(hooks.localStamp(new Date(2026, 9, 19, 14, 12, 5)), '2026-10-19 14:12:05');
  assert.equal(hooks.localStamp(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01 00:00:00');
  assert.equal(hooks.localStamp(new Date(2026, 0, 1, 23, 59, 59)), '2026-01-01 23:59:59');
  assert.match(hooks.localStamp(new Date(2026, 5, 9, 13, 7, 4)), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('isDayString يقبل التواريخ الحقيقية فقط', () => {
  const { hooks } = fresh();
  assert.equal(hooks.isDayString('2026-02-28'), true);
  assert.equal(hooks.isDayString('2024-02-29'), true); // سنة كبيسة
  assert.equal(hooks.isDayString('2026-02-31'), false); // يوم غير موجود
  assert.equal(hooks.isDayString('2025-02-29'), false); // غير كبيسة
  assert.equal(hooks.isDayString('2026-13-01'), false); // شهر غير موجود
  assert.equal(hooks.isDayString('2026-2-3'), false); // صيغة ناقصة
  assert.equal(hooks.isDayString('abc'), false);
  assert.equal(hooks.isDayString(20260101), false); // عدد لا نص
  assert.equal(hooks.isDayString(null), false);
});

test('isFutureDay يرفض ما بعد الغد فقط', () => {
  const { hooks } = fresh();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
  assert.equal(hooks.isFutureDay(hooks.todayKey()), false);
  assert.equal(hooks.isFutureDay(hooks.dateKeyOf(tomorrow)), false);
  assert.equal(hooks.isFutureDay(hooks.dateKeyOf(dayAfter)), true);
});

test('daysAgoText يصوغ «قبل N» بالعربية', () => {
  const { hooks } = fresh();
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
  assert.equal(hooks.daysAgoText(new Date().toISOString()), 'اليوم');
  assert.equal(hooks.daysAgoText(ago(1)), 'قبل يوم واحد');
  assert.equal(hooks.daysAgoText(ago(2)), 'قبل يومين');
  assert.equal(hooks.daysAgoText(ago(5)), 'قبل 5 أيام');
  assert.equal(hooks.daysAgoText(ago(10)), 'قبل 10 أيام');
  assert.equal(hooks.daysAgoText(ago(11)), 'قبل 11 يومًا');
  assert.equal(hooks.daysAgoText(ago(40)), 'قبل 40 يومًا');
  assert.equal(hooks.daysAgoText('not-a-date'), '');
});

// ===== تطبيع البحث والبحث =====
test('normalizeArabic يوحّد الهمزات والتاء المربوطة والألف المقصورة ويحذف التشكيل', () => {
  const { hooks } = fresh();
  assert.equal(hooks.normalizeArabic('إبراهيم'), 'ابراهيم');
  assert.equal(hooks.normalizeArabic('أحمد'), 'احمد');
  assert.equal(hooks.normalizeArabic('آدم'), 'ادم');
  assert.equal(hooks.normalizeArabic('فاطمة'), 'فاطمه');
  assert.equal(hooks.normalizeArabic('موسى'), 'موسي');
  assert.equal(hooks.normalizeArabic('مُحَمَّد'), 'محمد');
  assert.equal(hooks.normalizeArabic(null), '');
  assert.equal(hooks.normalizeArabic(''), '');
});

test('normalizeDigits يحوّل المشرقية والفارسية ويجرد المسافات والأصفار البادئة', () => {
  const { hooks } = fresh();
  assert.equal(hooks.normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '123456789');
  assert.equal(hooks.normalizeDigits('۰۱۲۳۴۵۶۷۸۹'), '123456789');
  assert.equal(hooks.normalizeDigits('٠٧'), '7');
  assert.equal(hooks.normalizeDigits('۰۹'), '9');
  assert.equal(hooks.normalizeDigits(' ٢٠ '), '20');
  assert.equal(hooks.normalizeDigits('0042'), '42');
  assert.equal(hooks.normalizeDigits('0'), '0');
  assert.equal(hooks.normalizeDigits('abc'), 'abc');
  assert.equal(hooks.normalizeDigits(''), '');
});

test('surahMatches يطابق العربي المطبَّع والإنجليزي والرقم', () => {
  const { hooks } = fresh();
  const fatiha = { number: 1, name: 'الفاتحة', english: 'Al-Fatihah', ayahs: 7, type: 'مكية' };
  const baqara = { number: 2, name: 'البقرة', english: 'Al-Baqarah', ayahs: 286, type: 'مدنية' };
  const ibrahim = { number: 14, name: 'إبراهيم', english: 'Ibrahim', ayahs: 52, type: 'مكية' };
  assert.equal(hooks.surahMatches(fatiha, ''), true); // بحث فارغ يعرض الكل
  assert.equal(hooks.surahMatches(fatiha, 'الفاتحة'), true);
  assert.equal(hooks.surahMatches(fatiha, 'الفاتحه'), true); // ة → ه
  assert.equal(hooks.surahMatches(fatiha, 'الفاتحا'), false);
  assert.equal(hooks.surahMatches(ibrahim, 'ابراهيم'), true); // همزة مطبَّعة
  assert.equal(hooks.surahMatches(baqara, 'بقر'), true); // مطابقة جزئية
  assert.equal(hooks.surahMatches(baqara, 'fatih'), false);
  assert.equal(hooks.surahMatches(fatiha, 'fatih'), true); // إنجليزي بلا حساسية لحالة الأحرف
  assert.equal(hooks.surahMatches(fatiha, 'FATIHAH'), true);
  assert.equal(hooks.surahMatches(baqara, '2'), true); // رقم مطابق تمامًا
  assert.equal(hooks.surahMatches(baqara, '٢'), true); // رقم مشرقي
  assert.equal(hooks.surahMatches(baqara, '02'), true); // صفر بادئ يُجرَّد
  assert.equal(hooks.surahMatches(fatiha, '2'), false); // لا يطابق رقم غيره
  assert.equal(hooks.surahMatches(ibrahim, '2'), false); // 14 ليست 2
});

// ===== تجريد البسملة =====
test('stripBasmalaPrefix يجرّد «بسم الله الرحمن الرحيم» حين تتصدّر', () => {
  const { hooks } = fresh();
  const full = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ';
  assert.equal(hooks.stripBasmalaPrefix(full + 'الْحَمْدُ لِلَّهِ'), 'الْحَمْدُ لِلَّهِ');
  assert.equal(hooks.stripBasmalaPrefix('بسم الله الرحمن الرحيم الرحمن'), 'الرحمن');
  assert.equal(hooks.stripBasmalaPrefix('الْحَمْدُ لِلَّهِ'), 'الْحَمْدُ لِلَّهِ'); // بلا بسملة كما هي
  assert.equal(hooks.stripBasmalaPrefix('بسم الله'), 'بسم الله'); // أقل من 4 كلمات
});

// ===== حالة الختمة =====
test('defaultState هو المرجع الكامل للحالة الفارغة', () => {
  const { hooks } = fresh();
  const d = hooks.defaultState();
  assert.deepEqual(
    Object.keys(d).sort(),
    ['dailyGoal', 'fontSize', 'khatmaCount', 'last', 'lastExportAt', 'log', 'read', 'theme'].sort(),
  );
  assert.deepEqual(d.read, {});
  assert.deepEqual(d.log, {});
  assert.equal(d.last, null);
  assert.equal(d.khatmaCount, 0);
  assert.equal(d.dailyGoal, 20);
  assert.equal(d.fontSize, 1.9);
  assert.equal(d.theme, null);
  assert.equal(d.lastExportAt, null);
});

test('loadState يدمج المحفوظ فوق الافتراضي ويتحمل التالف', () => {
  const app = fresh();
  assert.deepEqual(app.hooks.loadState(), app.hooks.defaultState()); // لا شيء محفوظ
  app.localStorage.setItem('quran_tracker_v1', JSON.stringify({ khatmaCount: 3, dailyGoal: 40, extra: 'x' }));
  const s = app.hooks.loadState();
  assert.equal(s.khatmaCount, 3);
  assert.equal(s.dailyGoal, 40);
  assert.equal(s.fontSize, 1.9); // حقل ناقص → افتراضي
  assert.deepEqual(s.read, {});
  assert.equal(s.extra, 'x'); // حقل غير معروف يبقى (توافق أمامي)
  app.localStorage.setItem('quran_tracker_v1', '{oops');
  assert.deepEqual(app.hooks.loadState(), app.hooks.defaultState()); // JSON تالف
});

test('markAyahRead يعلّم الآية ويحدّث اليوم وآخر قراءة بلا تكرار', () => {
  const app = fresh();
  const today = app.hooks.todayKey();
  app.hooks.markAyahRead(2, 255, 'البقرة');
  const st = app.hooks.getState();
  assert.equal(st.read['2:255'], today);
  assert.equal(st.log[today], 1);
  assert.deepEqual(st.last, { surah: 2, ayah: 255, name: 'البقرة' });
  app.hooks.markAyahRead(2, 255, 'البقرة'); // إعادة التعليم لا تُضاعف
  assert.equal(app.hooks.readTotal(), 1);
  assert.equal(app.hooks.getState().log[today], 1);
});

test('toggleAyahRead يتراجع عن يوم التعليم الأصلي ويصفّر آخر قراءة', () => {
  const app = fresh();
  const today = app.hooks.todayKey();
  app.hooks.markAyahRead(2, 255, 'البقرة');
  app.hooks.toggleAyahRead(2, 255, 'البقرة');
  assert.equal(app.hooks.readTotal(), 0);
  assert.equal(app.hooks.getState().read['2:255'], undefined);
  assert.equal(app.hooks.getState().log[today], 0);
  assert.equal(app.hooks.getState().last, null);
});

test('toggleAyahRead يتعامل مع القيم القديمة true بلا إنقاص', () => {
  const app = fresh();
  app.hooks.setState({ ...app.hooks.defaultState(), read: { '1:1': true }, log: { '2020-01-01': 1 } });
  app.hooks.toggleAyahRead(1, 1, 'الفاتحة');
  assert.equal(app.hooks.getState().read['1:1'], undefined);
  assert.equal(app.hooks.getState().log['2020-01-01'], 1); // قيمة قديمة بلا يوم → لا تُنقص
  app.hooks.toggleAyahRead(1, 2, 'الفاتحة'); // من غير مقروءة → markAyahRead
  assert.equal(app.hooks.getState().read['1:2'], app.hooks.todayKey());
});

test('readTotal و readCountOf يحسبان بلا تداخل في البادئة', () => {
  const app = fresh();
  app.hooks.setState({
    ...app.hooks.defaultState(),
    read: { '1:1': '2026-01-01', '1:2': '2026-01-01', '11:1': '2026-01-01' },
  });
  assert.equal(app.hooks.readCountOf(1), 2); // لا يحسب 11:1
  assert.equal(app.hooks.readCountOf(11), 1);
  assert.equal(app.hooks.readTotal(), 3);
});

test('changeFontSize يحصر الحجم بين 1.2 و3 rem', () => {
  const app = fresh();
  app.hooks.changeFontSize(0.15);
  approx(app.hooks.getState().fontSize, 2.05);
  for (let i = 0; i < 30; i++) app.hooks.changeFontSize(0.15);
  assert.equal(app.hooks.getState().fontSize, 3); // السقف الأعلى
  for (let i = 0; i < 40; i++) app.hooks.changeFontSize(-0.15);
  assert.equal(app.hooks.getState().fontSize, 1.2); // الحد الأدنى
});

test('currentTheme يفضّل المحفوظ ثم يتبع النظام عند null', () => {
  const app = fresh();
  app.hooks.setState({ ...app.hooks.defaultState(), theme: 'dark' });
  assert.equal(app.hooks.currentTheme(), 'dark');
  app.hooks.setState({ ...app.hooks.defaultState(), theme: 'light' });
  assert.equal(app.hooks.currentTheme(), 'light');
  app.hooks.setState({ ...app.hooks.defaultState(), theme: null });
  assert.equal(app.hooks.currentTheme(), 'light'); // النظام فاتح
  app.setMatchMedia(() => ({ matches: true }));
  assert.equal(app.hooks.currentTheme(), 'dark'); // النظام داكن
});
