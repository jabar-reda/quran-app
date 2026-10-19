'use strict';
// اختبارات نقل التقدم v2 في js/app.js: التصدير، التحقق، المعاينة، الدمج/الاستبدال، التراجع.
// تواريخ الـ fixtures ثابتة في الماضي البعيد (2020) حتى لا تتقادم الاختبارات مع مرور الوقت.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppSandbox } = require('./harness.js');

const fresh = () => createAppSandbox();
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const D = (app) => app.hooks.defaultState();

// ===== fixtures =====
// كائن incoming كما ترجعه parseProgressFile (بعد التحقق).
function incoming(overrides) {
  return {
    read: { '1:1': '2020-01-01' },
    last: null,
    khatmaCount: 0,
    dailyGoal: 20,
    fontSize: 1.9,
    theme: null,
    log: {},
    exportedAt: null,
    ...(overrides || {}),
  };
}

// ملف v2 كامل بالغلاف والبيانات الوصفية.
function envelope(stateOverrides, envOverrides) {
  return {
    app: 'noor',
    kind: 'progress',
    version: 2,
    appVersion: '1.0.0',
    exportedAt: '2020-01-06T10:00:00.000Z',
    exportedAtLocal: '2020-01-06 13:00:00',
    timezone: { iana: 'Asia/Riyadh', offset: '+03:00' },
    source: { kind: 'web', origin: 'https://example.com/quran-app/' },
    device: { label: 'Windows • Chrome 141', platform: 'Windows', model: '', browser: 'Chrome 141', language: 'ar' },
    summary: { readCount: 1 },
    state: {
      ayahs: [{ surah: 1, ayah: 1, date: '2020-01-01' }],
      last: null,
      khatmaCount: 1,
      dailyGoal: 20,
      fontSize: 1.9,
      theme: null,
      log: { '2020-01-01': 1 },
      ...(stateOverrides || {}),
    },
    ...(envOverrides || {}),
  };
}

const parse = (app, obj) => app.hooks.parseProgressFile(typeof obj === 'string' ? obj : JSON.stringify(obj));

// ===== readToAyahs =====
test('readToAyahs يحوّل read إلى قائمة مرتبة ويميّز القيم القديمة', () => {
  const app = fresh();
  assert.deepEqual(app.hooks.readToAyahs({}), []);
  assert.deepEqual(
    app.hooks.readToAyahs({ '18:5': '2020-01-10', '2:255': '2019-12-31' }),
    [{ surah: 2, ayah: 255, date: '2019-12-31' }, { surah: 18, ayah: 5, date: '2020-01-10' }],
  );
  assert.deepEqual(app.hooks.readToAyahs({ '1:1': true }), [{ surah: 1, ayah: 1, date: null, legacy: true }]);
  assert.deepEqual(app.hooks.readToAyahs({ x: '2020-01-01', 18: '2020-01-01' }), []); // مفاتيح تالفة تُسقط
});

// ===== ayahsToRead =====
test('ayahsToRead يبني read من قائمة الآيات ويرفض كل عنصر تالف', () => {
  const app = fresh();
  let r = app.hooks.ayahsToRead([{ surah: 1, ayah: 1, date: '2020-01-01' }, { surah: 2, ayah: 255, date: null }]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.read, { '1:1': '2020-01-01', '2:255': true });
  assert.deepEqual(app.hooks.ayahsToRead([{ surah: 1, ayah: 2 }]).read, { '1:2': true }); // بلا تاريخ → true

  assert.equal(app.hooks.ayahsToRead({}).ok, false); // ليست مصفوفة
  assert.equal(app.hooks.ayahsToRead(null).ok, false);
  assert.equal(app.hooks.ayahsToRead(new Array(6237).fill({ surah: 1, ayah: 1 })).ok, false); // أكثر من 6236
  assert.equal(app.hooks.ayahsToRead([null]).ok, false); // عنصر غير كائن
  assert.equal(app.hooks.ayahsToRead([[1, 1]]).ok, false); // مصفوفة داخل مصفوفة
  assert.equal(app.hooks.ayahsToRead([{ surah: '1', ayah: 1 }]).ok, false); // نص رقمي
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: '1' }]).ok, false);
  assert.equal(app.hooks.ayahsToRead([{ surah: 1.5, ayah: 1 }]).ok, false); // غير صحيح
  assert.equal(app.hooks.ayahsToRead([{ surah: 115, ayah: 1 }]).ok, false); // سورة غير موجودة
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 8 }]).ok, false); // الفاتحة 7 آيات
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 0 }]).ok, false);
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 1 }, { surah: 1, ayah: 1 }]).ok, false); // تكرار
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 1, date: 20200101 }]).ok, false); // نوع تاريخ
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 1, date: '2020-02-31' }]).ok, false); // تاريخ غير حقيقي

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 1, date: app.hooks.dateKeyOf(dayAfter) }]).ok, false); // مستقبلي
  assert.equal(app.hooks.ayahsToRead([{ surah: 1, ayah: 1, date: app.hooks.dateKeyOf(tomorrow) }]).ok, true); // الغد مقبول
});

// ===== buildSummary =====
test('buildSummary يحسب النسبة والمتبقي والسلسلة واليوم بنفس صيغ الواجهة', () => {
  const app = fresh();
  const today = app.hooks.todayKey();
  const yesterday = app.hooks.dateKeyOf(new Date(Date.now() - 86400000));
  app.hooks.setState({
    ...D(app),
    read: { '1:1': today, '1:2': today, '1:3': yesterday },
    log: { [today]: 2, [yesterday]: 1 },
    khatmaCount: 2,
    dailyGoal: 5,
  });
  const s = app.hooks.buildSummary();
  assert.equal(s.readCount, 3);
  assert.equal(s.totalAyahs, 6236);
  assert.equal(s.remaining, 6233);
  assert.equal(s.percent, Math.round((3 / 6236) * 10000) / 100);
  assert.equal(s.khatmaCount, 2);
  assert.equal(s.activeDays, 2);
  assert.equal(s.streakDays, 2);
  assert.equal(s.firstReadDate, yesterday);
  assert.deepEqual(s.today, { date: today, count: 2, goal: 5, remaining: 3, met: false });
});

test('buildSummary يعدّ السلسلة من الأمس حين يكون اليوم صفرًا', () => {
  const app = fresh();
  const yesterday = app.hooks.dateKeyOf(new Date(Date.now() - 86400000));
  app.hooks.setState({ ...D(app), log: { [yesterday]: 3 } });
  const s = app.hooks.buildSummary();
  assert.equal(s.today.count, 0);
  assert.equal(s.streakDays, 1);
  assert.equal(s.today.met, false);
});

test('buildSummary يعدّ السور المكتملة ويعلّم بلوغ الورد', () => {
  const app = fresh();
  const today = app.hooks.todayKey();
  const read = {};
  for (let i = 1; i <= 7; i++) read['1:' + i] = today; // كل آيات الفاتحة
  app.hooks.setState({ ...D(app), read, log: { [today]: 7 }, dailyGoal: 7 });
  const s = app.hooks.buildSummary();
  assert.equal(s.completedSurahs, 1);
  assert.equal(s.today.met, true);
  assert.equal(s.today.remaining, 0);
});

// ===== collectProgress =====
test('collectProgress يبني غلاف v2 وصفًا كاملًا وحالة بلا read مكرر', () => {
  const app = fresh();
  const today = app.hooks.todayKey();
  app.hooks.setState({
    ...D(app),
    read: { '18:5': today },
    log: { [today]: 1 },
    last: { surah: 18, ayah: 5, name: 'الكهف' },
    khatmaCount: 1,
    theme: 'dark',
  });
  const p = app.hooks.collectProgress();
  assert.equal(p.app, 'noor');
  assert.equal(p.kind, 'progress');
  assert.equal(p.version, 2);
  assert.equal(p.appVersion, '1.0.0');
  assert.ok(!Number.isNaN(Date.parse(p.exportedAt)));
  assert.match(p.exportedAtLocal, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(p.exportedAtLocal.slice(0, 10), app.hooks.dateKeyOf(new Date(p.exportedAt)));
  assert.equal(typeof p.timezone.iana, 'string');
  assert.ok(p.timezone.iana.length > 0);
  assert.match(p.timezone.offset, /^[+-]\d{2}:\d{2}$/);
  assert.deepEqual(p.source, { kind: 'localhost', origin: 'http://localhost:8000' });
  assert.deepEqual(Object.keys(p.device).sort(), ['browser', 'label', 'language', 'model', 'platform'].sort());
  assert.equal(typeof p.summary, 'object');
  assert.deepEqual(p.state.ayahs, [{ surah: 18, ayah: 5, date: today }]);
  assert.equal('read' in p.state, false); // لا read مكرر
  assert.equal(p.state.khatmaCount, 1);
  assert.equal(p.state.theme, 'dark');
  assert.deepEqual(p.state.log, { [today]: 1 });
  assert.equal(p.state.last.surah, 18);
  // الحقول الوصفية لا تتسرب إلى state
  assert.equal('summary' in p.state, false);
  assert.equal('device' in p.state, false);
  assert.equal('source' in p.state, false);
  assert.equal('exportedAt' in p.state, false);
});

// ===== parseProgressFile =====
test('parseProgressFile يرفض غير JSON وغير الكائن', () => {
  const app = fresh();
  assert.match(app.hooks.parseProgressFile('{oops').error, /JSON/);
  assert.equal(app.hooks.parseProgressFile('[]').ok, false);
  assert.equal(app.hooks.parseProgressFile('null').ok, false);
  assert.equal(app.hooks.parseProgressFile('42').ok, false);
});

test('parseProgressFile يقبل ملف v2 كاملًا ويكشف الغلاف الوصفي', () => {
  const app = fresh();
  const r = parse(app, envelope());
  assert.equal(r.ok, true);
  assert.deepEqual(r.incoming.read, { '1:1': '2020-01-01' });
  assert.equal(r.incoming.khatmaCount, 1);
  assert.equal(r.incoming.dailyGoal, 20);
  assert.equal(r.incoming.fontSize, 1.9);
  assert.equal(r.incoming.theme, null);
  assert.equal(r.incoming.exportedAt, '2020-01-06T10:00:00.000Z');
  assert.equal(r.meta.version, 2);
  assert.equal(r.meta.appVersion, '1.0.0');
  assert.equal(r.meta.exportedAtLocal, '2020-01-06 13:00:00');
  assert.deepEqual(r.meta.source, { kind: 'web', origin: 'https://example.com/quran-app/' });
  assert.equal(r.meta.device.label, 'Windows • Chrome 141');
});

test('parseProgressFile يرفض نسخة أحدث من المعروفة', () => {
  const app = fresh();
  const r = parse(app, envelope(null, { version: 3 }));
  assert.equal(r.ok, false);
  assert.match(r.error, /أحدث/);
});

test('parseProgressFile يقبل v1 (خريطة read) والقيم القديمة true', () => {
  const app = fresh();
  const r = parse(app, { state: { read: { '1:1': '2020-01-01', '2:2': true }, khatmaCount: 4, dailyGoal: 33, fontSize: 2.4, theme: 'light', log: { '2020-01-01': 1 } } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.incoming.read, { '1:1': '2020-01-01', '2:2': true });
  assert.equal(r.incoming.khatmaCount, 4);
  assert.equal(r.incoming.dailyGoal, 33);
  approx(r.incoming.fontSize, 2.4);
  assert.equal(r.incoming.theme, 'light');
  assert.equal(r.meta.version, 1); // بلا version
});

test('parseProgressFile يقبل كائن حالة خام بلا غلاف', () => {
  const app = fresh();
  const r = parse(app, { read: { '1:1': '2020-01-01' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.incoming.read, { '1:1': '2020-01-01' });
});

test('parseProgressFile يرفض مفاتيح v1 التالفة والخارج عن الفهرس', () => {
  const app = fresh();
  assert.equal(parse(app, { state: { read: { abc: '2020-01-01' } } }).ok, false);
  assert.equal(parse(app, { state: { read: { 1: '2020-01-01' } } }).ok, false); // بلا نقطتين
  assert.equal(parse(app, { state: { read: { '1:8': '2020-01-01' } } }).ok, false); // خارج آيات الفاتحة
  assert.equal(parse(app, { state: { read: { '115:1': '2020-01-01' } } }).ok, false); // سورة غير موجودة
  assert.equal(parse(app, { state: { read: { '1:1': '2020-02-31' } } }).ok, false); // تاريخ غير حقيقي
});

test('parseProgressFile يرفض ما يزيد عن آيات المصحف في v1', () => {
  const app = fresh();
  const bigRead = {};
  for (let i = 1; i <= 6237; i++) bigRead['1:' + i] = '2020-01-01';
  const r = parse(app, { state: { read: bigRead } });
  assert.equal(r.ok, false);
  assert.match(r.error, /6237/);
});

test('parseProgressFile يرفض غياب read و ayahs معًا وأنواعهما الخاطئة', () => {
  const app = fresh();
  assert.equal(parse(app, { state: {} }).ok, false);
  assert.equal(parse(app, { state: { read: [] } }).ok, false);
  assert.equal(parse(app, { state: { read: 'x' } }).ok, false);
});

test('parseProgressFile يرجّح ayahs على read عند وجودهما', () => {
  const app = fresh();
  const r = parse(app, { version: 2, state: { ayahs: [{ surah: 3, ayah: 1, date: '2020-01-02' }], read: { '1:1': '2020-01-01' } } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.incoming.read, { '3:1': '2020-01-02' }); // read مُتجاهل
});

test('parseProgressFile يقرأ ayahs من الجذر أيضًا', () => {
  const app = fresh();
  const r = parse(app, { version: 2, ayahs: [{ surah: 1, ayah: 1, date: null }], state: { last: null } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.incoming.read, { '1:1': true });
});

test('parseProgressFile يتحقق من موضع آخر قراءة', () => {
  const app = fresh();
  assert.deepEqual(parse(app, envelope({ last: { surah: 2, ayah: 255 } })).incoming.last, { surah: 2, ayah: 255, name: 'البقرة' });
  assert.equal(parse(app, envelope({ last: { surah: 2, ayah: 999 } })).ok, false);
  assert.equal(parse(app, envelope({ last: { surah: 115, ayah: 1 } })).ok, false);
  assert.match(parse(app, envelope({ last: { surah: 2, ayah: 999 } })).error, /آخر قراءة/);
});

test('parseProgressFile يقيّد الإعدادات داخل حدودها', () => {
  const app = fresh();
  assert.equal(parse(app, envelope({ dailyGoal: 0 })).incoming.dailyGoal, 1);
  assert.equal(parse(app, envelope({ dailyGoal: 999 })).incoming.dailyGoal, 500);
  assert.equal(parse(app, envelope({ dailyGoal: '50' })).incoming.dailyGoal, 50);
  assert.equal(parse(app, envelope({ dailyGoal: 'x' })).incoming.dailyGoal, 20);
  assert.equal(parse(app, envelope({ dailyGoal: 20.6 })).incoming.dailyGoal, 21);
  assert.equal(parse(app, envelope({ fontSize: 1 })).incoming.fontSize, 1.2);
  assert.equal(parse(app, envelope({ fontSize: 5 })).incoming.fontSize, 3);
  assert.equal(parse(app, envelope({ fontSize: '2' })).incoming.fontSize, 2);
  assert.equal(parse(app, envelope({ fontSize: 'x' })).incoming.fontSize, 1.9);
  assert.equal(parse(app, envelope({ theme: 'dark' })).incoming.theme, 'dark');
  assert.equal(parse(app, envelope({ theme: 'blue' })).incoming.theme, null);
  assert.equal(parse(app, envelope({ khatmaCount: 5 })).incoming.khatmaCount, 5);
  assert.equal(parse(app, envelope({ khatmaCount: -1 })).incoming.khatmaCount, 0);
  assert.equal(parse(app, envelope({ khatmaCount: 2.5 })).incoming.khatmaCount, 0);
  assert.equal(parse(app, envelope({ khatmaCount: '3' })).incoming.khatmaCount, 0);
});

test('parseProgressFile يقصّ البيانات الوصفية ويرفض نوع مصدر غير مسموح', () => {
  const app = fresh();
  let r = parse(app, envelope(null, { device: { label: 'x'.repeat(200) }, source: { kind: 'evil', origin: 'o' } }));
  assert.equal(r.meta.device.label.length, 80);
  assert.equal(r.meta.source, null);
  r = parse(app, envelope(null, { device: null }));
  assert.equal(r.meta.device, null);
  r = parse(app, envelope(null, { source: { kind: 'apk', origin: 'x'.repeat(500) } }));
  assert.equal(r.meta.source.kind, 'apk');
  assert.equal(r.meta.source.origin.length, 200);
  r = parse(app, envelope(null, { appVersion: 'y'.repeat(100) }));
  assert.equal(r.meta.appVersion.length, 24);
});

test('parseProgressFile يجعل exportedAt غير الصالح null', () => {
  const app = fresh();
  assert.equal(parse(app, envelope(null, { exportedAt: 'not-a-date' })).incoming.exportedAt, null);
});

// ===== describeImportMeta =====
test('describeImportMeta يبني سطر المعاينة أو يحذفه بهدوء', () => {
  const app = fresh();
  assert.equal(app.hooks.describeImportMeta(null), '');
  assert.equal(
    app.hooks.describeImportMeta({ source: { kind: 'web' }, device: { label: 'Pixel 7 • Android 14' }, exportedAtLocal: '2020-10-19 14:12:05' }),
    'الملف من: Pixel 7 • Android 14 (ويب) — أُنشئ: 2020-10-19 14:12:05. ',
  );
  assert.equal(app.hooks.describeImportMeta({ source: { kind: 'localhost' }, device: null, exportedAtLocal: '' }), 'الملف من: محلي. ');
  assert.equal(app.hooks.describeImportMeta({ source: null, device: { label: 'Windows • Chrome 141' }, exportedAtLocal: '' }), 'الملف من: Windows • Chrome 141. ');
  assert.equal(app.hooks.describeImportMeta({ source: null, device: null, exportedAtLocal: '' }), '');
  assert.equal(app.hooks.describeImportMeta({ source: { kind: 'evil' }, device: { label: 'X' }, exportedAtLocal: '' }), 'الملف من: X. '); // نوع مجهول بلا قوسين
  assert.equal(app.hooks.describeImportMeta({ source: null, device: null, exportedAtLocal: '2020-01-01 00:00:00' }), 'أُنشئ: 2020-01-01 00:00:00. ');
});

// ===== sanitizeLog =====
test('sanitizeLog يقبل الأيام الصالحة فقط ويحدّ الأعداد', () => {
  const app = fresh();
  assert.deepEqual(app.hooks.sanitizeLog(null), {});
  assert.deepEqual(app.hooks.sanitizeLog([]), {});
  assert.deepEqual(app.hooks.sanitizeLog('x'), {});
  assert.deepEqual(
    app.hooks.sanitizeLog({ '2020-01-01': 2, bad: 5, '2020-02-31': 1, '2020-01-02': -3, '2020-01-03': 1.2, '2020-01-04': '4', '2020-01-05': 999999 }),
    { '2020-01-01': 2, '2020-01-04': 4 },
  );
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
  assert.deepEqual(app.hooks.sanitizeLog({ [app.hooks.dateKeyOf(dayAfter)]: 1 }), {}); // مستقبلي يُسقط
});

// ===== mergeRead / mergeLog =====
test('mergeRead يأخذ الاتحاد ويفضّل أقدم تاريخ', () => {
  const app = fresh();
  assert.deepEqual(
    app.hooks.mergeRead({ '1:1': '2020-05-01', '2:2': '2020-06-01' }, { '1:1': '2020-01-01', '3:3': '2020-07-01' }),
    { '1:1': '2020-01-01', '2:2': '2020-06-01', '3:3': '2020-07-01' },
  );
  assert.deepEqual(app.hooks.mergeRead({ '1:1': true }, { '1:1': '2020-01-01' }), { '1:1': '2020-01-01' }); // true يُستبدل بتاريخ
  assert.deepEqual(app.hooks.mergeRead({ '1:1': '2020-01-01' }, { '1:1': true }), { '1:1': '2020-01-01' }); // العكس لا
  const local = { '1:1': '2020-01-01' };
  app.hooks.mergeRead(local, { '2:2': '2020-01-01' });
  assert.deepEqual(local, { '1:1': '2020-01-01' }); // لا يعدّل الأصل
});

test('mergeLog يعيد الحساب من read ثم لا ينقص السجل المحفوظ', () => {
  const app = fresh();
  assert.deepEqual(
    app.hooks.mergeLog({ '2020-01-01': 2 }, { '2019-12-31': 5 }, { '1:1': '2020-01-01', '1:2': '2020-01-01' }),
    { '2020-01-01': 2, '2019-12-31': 5 },
  );
  assert.deepEqual(app.hooks.mergeLog({}, { '2020-01-01': 9 }, { '1:1': '2020-01-01' }), { '2020-01-01': 9 }); // max يحفظ التاريخ
  assert.deepEqual(app.hooks.mergeLog({}, {}, {}), {});
});

// ===== applyImport / undoImport =====
test('applyImport بالدمج: اتحاد الآيات وأقدم تاريخ + إعدادات و last محليين', () => {
  const app = fresh();
  app.hooks.setState({
    ...D(app),
    read: { '1:1': '2020-05-01' },
    log: { '2020-05-01': 1 },
    khatmaCount: 1,
    last: { surah: 1, ayah: 1, name: 'الفاتحة' },
    dailyGoal: 20,
    fontSize: 1.9,
    theme: null,
  });
  const inc = incoming({
    read: { '1:1': '2020-01-01', '2:1': '2020-06-01' },
    last: { surah: 2, ayah: 1, name: 'البقرة' },
    khatmaCount: 3,
    dailyGoal: 50,
    fontSize: 2.5,
    theme: 'dark',
    log: { '2020-06-01': 1 },
    exportedAt: '2020-07-01T00:00:00.000Z',
  });
  app.hooks.applyImport(inc, 'merge');
  const st = app.hooks.getState();
  assert.deepEqual(st.read, { '1:1': '2020-01-01', '2:1': '2020-06-01' }); // أقدم
  assert.equal(st.khatmaCount, 3); // max(1,3)
  assert.equal(st.dailyGoal, 20); // محلي يبقى
  assert.equal(st.fontSize, 1.9);
  assert.equal(st.theme, null);
  assert.deepEqual(st.last, { surah: 1, ayah: 1, name: 'الفاتحة' }); // last المحلي يبقى
  assert.equal(st.lastExportAt, null); // الدمج لا يغيّر آخر تصدير
  assert.deepEqual(st.log, { '2020-05-01': 1, '2020-01-01': 1, '2020-06-01': 1 });
  const backup = JSON.parse(app.localStorage.getItem(app.hooks.BACKUP_KEY));
  assert.deepEqual(backup.state.read, { '1:1': '2020-05-01' }); // نسخة ما قبل الاستيراد
  assert.ok(backup.savedAt);
  assert.equal(app.document.getElementById('undoImportBtn').hidden, false);
  assert.equal(app.document.getElementById('transferStatus').textContent, 'تم الدمج — أُضيفت 1 آية جديدة.');
});

test('applyImport بالاستبدال: كل الحقول من الملف و lastExportAt من exportedAt', () => {
  const app = fresh();
  app.hooks.setState({
    ...D(app),
    read: { '1:1': '2020-05-01' },
    log: { '2020-05-01': 1 },
    khatmaCount: 1,
    last: { surah: 1, ayah: 1, name: 'الفاتحة' },
    dailyGoal: 20,
    theme: 'light',
    lastExportAt: '2020-01-01T00:00:00.000Z',
  });
  const inc = incoming({
    read: { '1:1': '2020-01-01', '2:1': '2020-06-01' },
    last: { surah: 2, ayah: 1, name: 'البقرة' },
    khatmaCount: 3,
    dailyGoal: 50,
    fontSize: 2.5,
    theme: 'dark',
    log: { '2020-06-01': 1 },
    exportedAt: '2020-07-01T00:00:00.000Z',
  });
  app.hooks.applyImport(inc, 'replace');
  const st = app.hooks.getState();
  assert.deepEqual(st.read, { '1:1': '2020-01-01', '2:1': '2020-06-01' });
  assert.equal(st.khatmaCount, 3);
  assert.equal(st.dailyGoal, 50);
  assert.equal(st.fontSize, 2.5);
  assert.equal(st.theme, 'dark');
  assert.deepEqual(st.last, { surah: 2, ayah: 1, name: 'البقرة' });
  assert.equal(st.lastExportAt, '2020-07-01T00:00:00.000Z');
  assert.deepEqual(st.log, { '2020-01-01': 1, '2020-06-01': 1 }); // يُعاد من read
  assert.equal(app.document.getElementById('transferStatus').textContent, 'تم استبدال التقدم من الملف.');
});

test('undoImport يستعيد ما قبل الاستيراد ويحذف النسخة', () => {
  const app = fresh();
  const before = { ...D(app), read: { '1:1': '2020-05-01' }, log: { '2020-05-01': 1 }, khatmaCount: 1 };
  app.hooks.setState(before);
  app.hooks.applyImport(incoming({ read: { '2:1': '2020-06-01' } }), 'merge');
  app.hooks.undoImport();
  assert.deepEqual(app.hooks.getState().read, { '1:1': '2020-05-01' });
  assert.equal(app.hooks.getState().khatmaCount, 1);
  assert.equal(app.localStorage.getItem(app.hooks.BACKUP_KEY), null);
  assert.equal(app.document.getElementById('undoImportBtn').hidden, true);
  assert.equal(app.document.getElementById('transferStatus').textContent, 'تم التراجع عن الاستيراد.');
});

test('undoImport بلا نسخة سابقة لا يفعل شيئًا', () => {
  const app = fresh();
  app.hooks.undoImport();
  assert.equal(app.document.getElementById('transferStatus').textContent, 'لا توجد نسخة سابقة للتراجع.');
  assert.equal(app.document.getElementById('undoImportBtn').hidden, true);
});

test('زر التراجع يختفي بعد مهلة العشر ثوانٍ', () => {
  const app = fresh();
  app.hooks.applyImport(incoming(), 'merge');
  assert.equal(app.document.getElementById('undoImportBtn').hidden, false);
  app.timers.flush(); // تنفيذ مؤقت الإخفاء
  assert.equal(app.document.getElementById('undoImportBtn').hidden, true);
});

// ===== exportProgress =====
test('exportProgress ينزّل ملف v2 باسم بالطابع المحلي ويحدّث آخر تصدير', () => {
  const app = fresh();
  const today = app.hooks.todayKey();
  app.hooks.setState({ ...D(app), read: { '18:5': today }, log: { [today]: 1 }, lastExportAt: null });
  app.hooks.exportProgress();
  const anchor = app.document._created.find((el) => el.tagName === 'A');
  assert.ok(anchor, 'أُنشئ رابط التنزيل');
  assert.match(anchor.download, /^noor-progress-\d{4}-\d{2}-\d{2}-\d{6}\.json$/);
  const payload = JSON.parse(app.URL.lastBlob.parts[0]);
  assert.equal(payload.version, 2);
  assert.equal(payload.app, 'noor');
  assert.deepEqual(payload.state.ayahs, [{ surah: 18, ayah: 5, date: today }]);
  const expectedName = `noor-progress-${payload.exportedAtLocal.replace(' ', '-').replace(/:/g, '')}.json`;
  assert.equal(anchor.download, expectedName);
  assert.equal(app.hooks.getState().lastExportAt, payload.exportedAt);
  assert.equal(app.document.getElementById('transferStatus').textContent, 'بدأ تنزيل النسخة — احفظها في مكان آمن.');
});

test('تصدير ثم استيراد يعيد نفس الآيات والإعدادات (ذهاب وإياب)', () => {
  const src = fresh();
  const today = src.hooks.todayKey();
  src.hooks.setState({
    ...src.hooks.defaultState(),
    read: { '1:1': today, '2:255': '2020-01-01' },
    log: { [today]: 1, '2020-01-01': 1 },
    last: { surah: 2, ayah: 255, name: 'البقرة' },
    khatmaCount: 2,
    dailyGoal: 33,
    fontSize: 2.1,
    theme: 'dark',
  });
  const json = JSON.stringify(src.hooks.collectProgress());
  const r = fresh().hooks.parseProgressFile(json);
  assert.equal(r.ok, true);
  assert.deepEqual(r.incoming.read, src.hooks.getState().read);
  assert.equal(r.incoming.khatmaCount, 2);
  assert.equal(r.incoming.dailyGoal, 33);
  approx(r.incoming.fontSize, 2.1);
  assert.equal(r.incoming.theme, 'dark');
  assert.deepEqual(r.incoming.last, { surah: 2, ayah: 255, name: 'البقرة' });
});

test('القيمة القديمة true تُصدَّر {date:null, legacy:true} وتُستورد true', () => {
  const src = fresh();
  src.hooks.setState({ ...src.hooks.defaultState(), read: { '1:1': true } });
  const payload = src.hooks.collectProgress();
  assert.deepEqual(payload.state.ayahs, [{ surah: 1, ayah: 1, date: null, legacy: true }]);
  const r = fresh().hooks.parseProgressFile(JSON.stringify(payload));
  assert.deepEqual(r.incoming.read, { '1:1': true });
});
