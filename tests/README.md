# اختبارات «نور · مصحف الختمة»

اختبارات محلية بلا أي اعتماديات (`package.json` غير موجودة عن قصد). تعتمد فقط على وحدات Node المدمجة
(`node:test`، `node:assert`، `node:fs`، `node:path`، `node:vm`)، ولا تعدّل ملفات المشروع ولا تحتاج خادمًا.

## التشغيل

من جذر المشروع:

```bash
node --test
```

يكتشف Node ملفات `tests/*.test.js` تلقائيًا. أو صرّح بالملفات صراحةً (يعمل على كل إصدارات Node):

```bash
node --test tests/harness.test.js tests/app-logic.test.js tests/progress-v2.test.js tests/preload.test.js tests/data-integrity.test.js
```

أو ملفًا واحدًا، مثلًا:

```bash
node --test tests/progress-v2.test.js
```

> **لا تكتب `node --test tests/`** (أو أي مجلد بلاحقة `/`): على Node 24 يُعامَل المسار كملف وحدة فيفشل بـ `MODULE_NOT_FOUND` قبل تشغيل الاختبارات. يتطلب Node 18 فأحدث، ولا حاجة إلى `npm install`.

## الملفات

| الملف | ماذا يغطي |
|---|---|
| `harness.js` | الحزمة: stub لـ `window/document/localStorage/navigator/fetch/Blob/URL/timers` + تحميل `js/app.js` و`js/preload.js` في sandbox معزول من `node:vm`، وكشف الدوال الداخلية عبر `window.__hooks`. |
| `harness.test.js` | سلامة الحزمة نفسها (تُحمّل الملفات وتُكشف الواجهات). |
| `app-logic.test.js` | أدوات التاريخ والوقت، تطبيع البحث العربي/الأرقام، تجريد البسملة، وحالة الختمة (`read`/`log`/`last`). |
| `progress-v2.test.js` | نقل التقدم v2: `readToAyahs`/`ayahsToRead`، `buildSummary`، `collectProgress`، `parseProgressFile` (v1/v2/رفض الأحدث/التحقق)، `describeImportMeta`، `sanitizeLog`، `mergeRead`/`mergeLog`، `applyImport` (دمج/استبدال)، `undoImport`، واسم ملف التصدير. |
| `preload.test.js` | طابور التحميل الخلفي: الترتيب (جوار الحالية ثم 18/36/56 ثم البقية)، تخطي المحفوظ، `dequeue`، الإيقاف بـ `userActive`، وإعادة المحاولة عند الفشل. |
| `data-integrity.test.js` | `data/surahs.json` (114 سورة، المجموع 6236)، `data/daily.json`، و`js/offline-surahs.js` (السور الأربع). |

## كيف تعمل الحزمة

`js/app.js` و`js/preload.js` سكربتات متصفح يُنفَّذان عند التحميل (و`app.js` ينادي `init()` في آخره).
لذلك تُحمّل في سياق `vm` مع بدائل بسيطة:

- `fetch` الافتراضي وعد لا يُحل أبدًا، فيتوقف `init()` عند أول `await` ولا يلمس الواجهة — تُضبط الحالة
  والفهرس يدويًا عبر `app.hooks.setState` / `app.hooks.setSurahs` (و`createAppSandbox` يضبطهما افتراضيًا).
- `document` بديل متسامح: `getElementById` يرجع عنصرًا ثابتًا لكل id، و`querySelector` لا يرجع `null`.
- المؤقتات مزيّفة (`timers.flush()`) حتى لا تُعلّق عملية Node، و`preload.test.js` يستخدم مؤقتات فورية
  (microtask) لإنهاء الطابور بسرعة، أو مزيّفة للتحكم الدقيق.
- **حدود عالم `vm`:** الكائنات المنشأة داخل sandbox لها `Object.prototype` مختلف، فيرفضها
  `assert.deepEqual` (alias لـ `deepStrictEqual`) رغم تطابق المحتوى. لذلك يمرّر `harness.js`
  كل قيمة تعود من `window.__hooks` عبر `toHost` (يعيد بناءها بـ `structuredClone` في عالم Node)،
  ويحوّل `detail` في `CustomEvent` بالطريقة نفسها. لا حاجة لأي تحويل في ملفات الاختبار.

## ملاحظات

- تواريخ الـ fixtures ثابتة في الماضي (2020) حتى لا تتقادم مع مرور الوقت.
- الاختبارات لا تلمس `localStorage` الحقيقي ولا الشبكة ولا خادمًا محليًا.
- عند تغيير سلوك في `js/app.js` أو `js/preload.js` يُتوقع تحديث الاختبارات في نفس التغيير.
