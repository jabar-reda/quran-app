'use strict';
// اختبارات سلامة بيانات المشروع: فهرس السور، آية اليوم، والسور المضمّنة للعمل دون إنترنت.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readSurahs, readOfflineSurahs, readProjectFile, createAppSandbox } = require('./harness.js');

const surahs = readSurahs();

test('فهرس السور: 114 سورة مرقّمة 1..114 بالترتيب', () => {
  assert.equal(surahs.length, 114);
  surahs.forEach((s, i) => assert.equal(s.number, i + 1, `الترتيب عند ${i + 1}`));
});

test('فهرس السور: كل حقول السورة موجودة وصالحة', () => {
  surahs.forEach((s) => {
    assert.equal(typeof s.name, 'string');
    assert.ok(s.name.length > 0, `اسم السورة ${s.number}`);
    assert.equal(typeof s.english, 'string');
    assert.ok(s.english.length > 0, `english السورة ${s.number}`);
    assert.ok(Number.isInteger(s.ayahs) && s.ayahs > 0, `عدد آيات السورة ${s.number}`);
    assert.ok(s.type === 'مكية' || s.type === 'مدنية', `نوع السورة ${s.number}`);
  });
});

test('فهرس السور: مجموع الآيات 6236 ويساوي TOTAL_AYAS في الكود', () => {
  const total = surahs.reduce((n, s) => n + s.ayahs, 0);
  assert.equal(total, 6236);
  const { hooks } = createAppSandbox();
  assert.equal(hooks.TOTAL_AYAS, total); // لا تنفصل الأرقام عن الكود
});

test('آية اليوم: قائمة غير فارغة وعناصرها نصية صالحة', () => {
  const data = JSON.parse(readProjectFile('data/daily.json'));
  const list = Array.isArray(data) ? data : data.daily;
  assert.ok(Array.isArray(list) && list.length > 0, 'قائمة daily غير فارغة');
  list.forEach((item, i) => {
    assert.equal(typeof item.text, 'string', `text عند ${i}`);
    assert.ok(item.text.trim().length > 0, `text فارغ عند ${i}`);
    if ('ref' in item) assert.equal(typeof item.ref, 'string', `ref عند ${i}`);
  });
});

test('السور المضمّنة offline: أربع سور (1/112/113/114) بالشكل الصحيح ومطابقة للفهرس', () => {
  const off = readOfflineSurahs();
  assert.deepEqual(Object.keys(off).map(Number).sort((a, b) => a - b), [1, 112, 113, 114]);
  Object.entries(off).forEach(([n, s]) => {
    const num = Number(n);
    const meta = surahs.find((x) => x.number === num);
    assert.ok(meta, `السورة ${num} موجودة في الفهرس`);
    assert.ok(Array.isArray(s.ayahs), `ayahs مصفوفة للسورة ${num}`);
    assert.equal(s.ayahs.length, meta.ayahs, `عدد آيات السورة ${num}`);
    s.ayahs.forEach((a, i) => {
      assert.equal(a.number, i + 1, `ترقيم آيات السورة ${num}`);
      assert.equal(typeof a.text, 'string');
      assert.ok(a.text.length > 0, `نص آية ${num}:${i + 1}`);
    });
  });
});

test('رسالة خطأ التحميل في app.js تذكر السور المضمّنة الأربع', () => {
  const src = readProjectFile('js/app.js');
  ['الفاتحة', 'الإخلاص', 'الفلق', 'الناس'].forEach((name) => {
    assert.ok(src.includes(name), `الرسالة تذكر ${name}`);
  });
});
