# ملف نقل التقدم v2 — المرجع الكامل

> مرجع صيغة ملف التصدير/الاستيراد في «نور — مصحف الختمة». الصيغة الحالية **v2** (`PROGRESS_FORMAT = 2` في `js/app.js:358`)، وإصدار التطبيق المعلن `APP_VERSION = '1.0.0'` (`js/app.js:360`).
> الملف يُنشأ ويُقرأ محليًا فقط: لا شبكة، ولا رفع، ولا حسابات. راجع §12.

## 1. الغرض

ملف JSON واحد ينقل **تقدم الختمة والإعدادات** بين المتصفح وتطبيق APK أو بين جهازين، ويصلح نسخة احتياطية قبل مسح بيانات المتصفح.

- **التصدير:** يبني الملف من الحالة الحالية ثم ينزّله عبر `Blob` (`exportProgress` في `js/app.js:582-598`).
- **الاستيراد:** يتحقق من الملف كاملًا قبل أي أثر (`parseProgressFile` في `js/app.js:601-701`)، يعرض معاينة، ثم يدمج أو يستبدل (`applyImport` في `js/app.js:791-830`).
- **النقل بين المتصفح وAPK يدوي بالكامل:** لا مزامنة سحابية ولا نقل تلقائي.

## 2. اسم الملف

```text
noor-progress-YYYY-MM-DD-HHmmss.json
```

- `YYYY-MM-DD` و`HHmmss` من **التوقيت المحلي** للجهاز (`localStamp` في `js/app.js:403-405`)، بساعة 24.
- البناء الفعلي (`js/app.js:589`): يأخذ `exportedAtLocal` بصيغة `YYYY-MM-DD HH:mm:ss`، يستبدل المسافة بـ `-`، ويحذف النقطتين.
- مثال: `noor-progress-2026-10-19-141205.json` يعني 19 أكتوبر 2026 الساعة 14:12:05 محليًا.
- لا يتغير الامتداد (`application/json`) ولا بادئة الاسم.

## 3. الغلاف

الملف كائن JSON غير مصفوفة، بأحد عشر حقلًا في الجذر:

```json
{
  "app": "noor",
  "kind": "progress",
  "version": 2,
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-19T11:12:05.123Z",
  "exportedAtLocal": "2026-10-19 14:12:05",
  "timezone": { "iana": "Asia/Riyadh", "offset": "+03:00" },
  "source": { "kind": "web", "origin": "https://example.com/quran-app/" },
  "device": {
    "label": "Pixel 7 • Android 14",
    "platform": "Android 14",
    "model": "Pixel 7",
    "browser": "Chrome 141",
    "language": "ar"
  },
  "summary": { "…": "انظر §7" },
  "state": { "…": "انظر §4" }
}
```

| الحقل | النوع | القيمة / المعنى | يُستورد؟ |
|---|---|---|---|
| `app` | string | ثابت `"noor"` للتعريف | لا |
| `kind` | string | ثابت `"progress"` لتمييز الملف عن أي JSON آخر | لا |
| `version` | number | إصدار **صيغة الملف** = `2`؛ إن كان أعلى من 2 يُرفض الملف | لا (يُقرأ للرفض وللمعاينة فقط) |
| `appVersion` | string | إصدار التطبيق وقت التصدير `"1.0.0"` | لا — وصفي |
| `exportedAt` | string | تاريخ التصدير UTC بصيغة ISO 8601 (`toISOString`) | لا — وصفي، إلا أنه يصبح `lastExportAt` في **الاستبدال** |
| `exportedAtLocal` | string | نفس اللحظة بالتوقيت المحلي `YYYY-MM-DD HH:mm:ss` بساعة 24 | لا — وصفي |
| `timezone` | object | `{iana, offset}` للمنطقة الزمنية للجهاز | لا — وصفي |
| `source` | object | `{kind, origin}` لبيئة التشغيل | لا — وصفي |
| `device` | object | وصف الجهاز المشتق من UA | لا — وصفي |
| `summary` | object | ملخص لحظي للختمة والورد | لا — وصفي |
| `state` | object | **البيانات القابلة للاستيراد** فقط | نعم |

> القاعدة الحاكمة: `summary` و`timezone` و`source` و`device` و`appVersion` **وصفية للعرض فقط**، ولا تُكتب في الحالة المحلية بأي حال.

## 4. `state` — البيانات القابلة للاستيراد

| الحقل | النوع | الوصف | التحقق عند الاستيراد |
|---|---|---|---|
| `ayahs` | array | قائمة الآيات المقروءة — **المرجع في v2** | مصفوفة ≤6236 عنصرًا، كل عنصر كائن صحيح، أعداد صحيحة داخل الفهرس، بلا تكرار، وتواريخ صالحة أو `null` |
| `last` | object \| null | موضع آخر قراءة `{surah, ayah, name}` | إن وُجد: يجب أن تكون السورة موجودة والآية صحيحة داخل حدودها، وإلا يُرفض الملف |
| `khatmaCount` | number | عدد الختمات المكتملة | عدد صحيح `≥ 0` وإلا يصبح `0` (لا يرفض الملف) |
| `dailyGoal` | number | الهدف اليومي بالآيات | إن كان رقمًا صالحًا يُقيَّد `1-500` ويُقرَّب؛ وإلا `20` |
| `fontSize` | number | حجم خط القارئ (rem) | إن كان رقمًا صالحًا يُقيَّد `1.2-3`؛ وإلا `1.9` |
| `theme` | string \| null | `'dark'` أو `'light'` أو `null` (تلقائي) | أي قيمة أخرى تصبح `null` |
| `log` | object | سجل الأيام `{"YYYY-MM-DD": عدد}` بتوقيت الجهاز المحلي | تُقبل التواريخ الحقيقية التي لا تتجاوز الغد والأعداد الصحيحة `0-6236` فقط؛ غير ذلك يُسقَط بهدوء |

ملاحظات:

- **لا يوجد `read` داخل ملف v2.** الخريطة الداخلية `read` تُحوَّل إلى `ayahs` عند التصدير (`readToAyahs` في `js/app.js:473-482`) ولا تُكرَّر في الملف.
- `state` هو مصدر التقدم والإعدادات الوحيد، ويُقرأ `exportedAt` من الغلاف لتحديث `lastExportAt` في الاستبدال.
- `lastExportAt` **ليس** حقلًا في `state` داخل الملف؛ يُشتق من `exportedAt` عند الاستبدال فقط.
- `log` قد يحتوي أيامًا أقدم من أقدم آية محفوظة (ختمات ماضية صُفّرت)، ولهذا لا يُعاد بناؤه حرفيًا من `ayahs` وحدها عند الاستيراد (انظر §10).

## 5. `ayahs` — قائمة الآيات

```json
"ayahs": [
  { "surah": 1, "ayah": 1, "date": "2026-10-17" },
  { "surah": 1, "ayah": 2, "date": "2026-10-17" },
  { "surah": 114, "ayah": 6, "date": null, "legacy": true }
]
```

قواعد البناء عند التصدير:

1. كل مفتاح في `state.read` يُفكّ إلى `surah` و`ayah` برقمين (`"18:5"` → `18` و`5`).
2. القيمة النصية (تاريخ التعليم) تصبح `date` كما هي.
3. القيمة القديمة `true` تصبح `{ date: null, legacy: true }` — حقل `legacy` إعلامي فقط.
4. تُستبعد العناصر غير الصحيحة، وتُرتَّب القائمة بالسورة ثم الآية تصاعديًا.
5. لا يُضاف أي حقل آخر (`text` أو `name` أو `page`) — الملف تقدم لا نص مصحف.

قواعد القراءة عند الاستيراد (`ayahsToRead` في `js/app.js:485-520`):

- إن لم يكن `ayahs` مصفوفة → رفض.
- أكثر من 6236 عنصرًا → رفض.
- كل عنصر يجب أن يكون كائنًا غير مصفوفة (`null` مرفوض).
- `surah` و`ayah` يجب أن تكونا `number` حقيقية وصحيحة (`Number.isInteger`) — النص الرقمي و`true` مرفوضان حتى لا يتحولا بصمت.
- السورة يجب أن توجد في الفهرس، والآية بين `1` و`meta.ayahs`.
- تكرار المفتاح `"سورة:آية"` → رفض الملف كاملًا.
- `date` مفقود أو `null` → تُستورد `true` (مقروءة بلا تاريخ، توافق قديم).
- `date` نص → يجب أن يكون `YYYY-MM-DD` حقيقيًا ولا يتجاوز الغد، وإلا رفض.
- أي خطأ واحد يرفض **الملف كاملًا**، ولا يُطبَّق أي جزء منه.

## 6. الحقول الوصفية

### 6.1 `appVersion`

إصدار التطبيق المنشور. قيمته الحالية `"1.0.0"` (`js/app.js:360`). لا علاقة له بـ `version` (صيغة الملف) ولا بـ `SW_CACHE` في `sw.js` (`noor-v1.0.1`، ويُرفع مع كل نشر يمس ملفات `CORE`). يُقرأ في `meta` للعرض ولا يدخل الحالة، لكنه لا يظهر في سطر المعاينة الحالي (`describeImportMeta` يعرض المصدر والجهاز وتاريخ الإنشاء فقط).

### 6.2 `exportedAt` و`exportedAtLocal`

| الحقل | الصيغة | مثال | المصدر |
|---|---|---|---|
| `exportedAt` | ISO 8601 UTC بالميلي ثانية | `2026-10-19T11:12:05.123Z` | `new Date().toISOString()` |
| `exportedAtLocal` | `YYYY-MM-DD HH:mm:ss` محلي بساعة 24 (0-23) بلا AM/PM | `2026-10-19 14:12:05` | `localStamp` (`js/app.js:403-405`) |

- `exportedAtLocal` هو ما يُعرض في سطر «أُنشئ: …» ويُبنى عليه اسم الملف.
- `exportedAt` يُقرأ من غلاف الملف أو من داخل `state` في النسخ اليدوية (`root.exportedAt ?? src.exportedAt`).
- عند الاستيراد يُقبل `exportedAt` صالح فقط؛ غير الصالح يصبح `null` ولا يمنع الاستيراد.
- **الاستبدال** ينسخ `exportedAt` إلى `state.lastExportAt` (`js/app.js:805`). **الدمج** لا يغيّر `lastExportAt` المحلي.

### 6.3 `timezone`

```json
{ "iana": "Asia/Riyadh", "offset": "+03:00" }
```

- `iana`: من `Intl.DateTimeFormat().resolvedOptions().timeZone`، واحتياطي `UTC`.
- `offset`: الإزاحة الحالية عن غرينتش بصيغة `+HH:MM` أو `-HH:MM` أو `+00:00` — **موجب شرق غرينتش** (`-getTimezoneOffset()`).
- أمثلة: الرياض `+03:00`، نيويورك صيفًا `-04:00`، كاتماندو `+05:45`.
- وصفي فقط؛ لا يُستخدم لتحويل تواريخ `ayahs` أو `log`، فهي بتوقيت الجهاز المحلي أصلًا.

### 6.4 `source`

```json
{ "kind": "pwa", "origin": "https://example.com/quran-app/" }
```

`kind` واحد من أربعة، ويُكتشف بالترتيب التالي (`detectSource` في `js/app.js:420-427`):

| القيمة | الشرط | الترجمة في المعاينة |
|---|---|---|
| `localhost` | `hostname` هو `localhost` أو `127.0.0.1` أو `::1` أو `[::1]` | محلي |
| `apk` | `document.referrer` يبدأ بـ `android-app://` أو `window.Capacitor?.isNativePlatform?.()` صادق | APK |
| `pwa` | `display-mode: standalone` أو `navigator.standalone === true` | مثبت |
| `web` | ما لم يتحقق أي شرط أعلاه | ويب |

- الترتيب مقصود: `localhost` يغلب `pwa` حتى لو كان التطبيق مثبتًا على خادم محلي.
- `origin` هو `location.origin` كما هو (قد يكشف نطاق الاستضافة). وصفي فقط.

### 6.5 `device`

```json
{
  "label": "Pixel 7 • Android 14",
  "platform": "Android 14",
  "model": "Pixel 7",
  "browser": "Chrome 141",
  "language": "ar"
}
```

مشتق من `navigator.userAgent` و`navigator.language` فقط، بلا مكتبات كشف (`detectDevice` في `js/app.js:430-469`):

- `platform`: أندرويد مع إصداره (`Android 14`)، أو `iPhone`، `iPad`، `Windows`، `macOS`، `Linux`، وإلا `Unknown`. الفحص يبدأ بأندرويد قبل لينكس، وبآيفون/آيباد قبل ماك.
- `model`: من نمط أندرويد القياسي «Android …; <MODEL> Build/»، ويُستبعد `wv` لأنه WebView لا طراز. فارغ على غير أندرويد أو عند فشل الاستخراج.
- `browser`: بالترتيب Edge → Opera → Chrome → Firefox → Safari، مع رقم الإصدار الرئيسي فقط (`Chrome 141`). الترتيب مهم لأن Edge وOpera يحملان Chrome في الـ UA، وChrome يحمل Safari.
- `label`: «الطراز • المنصة» إن وُجد طراز (مثل `Pixel 7 • Android 14`)، وإلا «المنصة • المتصفح» (مثل `Windows • Chrome 141`).
- `language`: `navigator.language` أو `ar` احتياطيًا.
- وصفي فقط، ولا حقل لتعديله يدويًا.

## 7. `summary`

ملخص لحظي يُبنى من الحالة والفهرس (`buildSummary` في `js/app.js:523-552`). **لا يُستورد إلى الحالة ولا يدخل حساب المعاينة** (المعاينة تحسب من `incoming.read` بنفسها)؛ وجوده لوصف الملف لمن يفتحه.

```json
{
  "readCount": 3,
  "totalAyahs": 6236,
  "percent": 0.05,
  "remaining": 6233,
  "khatmaCount": 2,
  "completedSurahs": 0,
  "activeDays": 3,
  "streakDays": 3,
  "firstReadDate": "2026-10-17",
  "today": { "date": "2026-10-19", "count": 3, "goal": 20, "remaining": 17, "met": false }
}
```

| الحقل | المعنى والحساب |
|---|---|
| `readCount` | عدد مفاتيح `read` = عدد الآيات المقروءة حاليًا |
| `totalAyahs` | `6236` دائمًا (`TOTAL_AYAS`) |
| `percent` | `Math.round(readCount / 6236 * 10000) / 100` — بحد أقصى منزلتين عشريتين |
| `remaining` | `6236 - readCount` |
| `khatmaCount` | `state.khatmaCount` |
| `completedSurahs` | عدد السور التي `readCountOf(surah) === meta.ayahs` (السورة كاملة فقط) |
| `activeDays` | عدد مفاتيح `log` التي قيمتها `> 0` |
| `streakDays` | الأيام المتتالية: يبدأ العدّ من اليوم إن كان فيه قراءة، وإلا من الأمس، ثم يرجع للخلف يومًا يومًا حتى أول يوم بلا قراءة |
| `firstReadDate` | أقدم يوم في `log` قيمته `> 0` (ترتيب نصي)، أو `null` |
| `today.date` | `todayKey()` المحلي `YYYY-MM-DD` |
| `today.count` | `state.log[today]` أو `0` |
| `today.goal` | `state.dailyGoal` أو `20` |
| `today.remaining` | `Math.max(0, goal - count)` |
| `today.met` | `count >= goal` |

تنبيه: `activeDays` و`streakDays` و`firstReadDate` مبنية على `log` (سجل الأيام) لا على تواريخ `ayahs` وحدها؛ لذلك قد تختلف عن عدد الأيام المشتقة من `ayahs` بعد ختمات سابقة صُفّرت.

## 8. مثال كامل

```json
{
  "app": "noor",
  "kind": "progress",
  "version": 2,
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-19T11:12:05.123Z",
  "exportedAtLocal": "2026-10-19 14:12:05",
  "timezone": { "iana": "Asia/Riyadh", "offset": "+03:00" },
  "source": { "kind": "web", "origin": "https://example.com/quran-app/" },
  "device": {
    "label": "Pixel 7 • Android 14",
    "platform": "Android 14",
    "model": "Pixel 7",
    "browser": "Chrome 141",
    "language": "ar"
  },
  "summary": {
    "readCount": 3,
    "totalAyahs": 6236,
    "percent": 0.05,
    "remaining": 6233,
    "khatmaCount": 2,
    "completedSurahs": 0,
    "activeDays": 3,
    "streakDays": 3,
    "firstReadDate": "2026-10-17",
    "today": { "date": "2026-10-19", "count": 3, "goal": 20, "remaining": 17, "met": false }
  },
  "state": {
    "ayahs": [
      { "surah": 1, "ayah": 1, "date": "2026-10-17" },
      { "surah": 1, "ayah": 2, "date": "2026-10-17" },
      { "surah": 114, "ayah": 6, "date": null, "legacy": true }
    ],
    "last": { "surah": 1, "ayah": 2, "name": "الفاتحة" },
    "khatmaCount": 2,
    "dailyGoal": 20,
    "fontSize": 1.9,
    "theme": null,
    "log": { "2026-10-19": 3, "2026-10-18": 2, "2026-10-17": 1 }
  }
}
```

## 9. الاستيراد والتحقق

### 9.1 المدخلات المقبولة

1. **ملف v2 كامل:** `{ state: { ayahs: [...] , … } }`.
2. **ملف v2 جذري:** `{ ayahs: [...] , … }` بلا غلاف `state`.
3. **ملف v1:** `{ state: { read: { "1:1": "2026-10-17" }, … } }` أو كائن حالة خام `{ read: … }`.
4. **غلاف مع `read` فقط:** يُقبل كـ v1 إن لم تكن `ayahs` مصفوفة.

الاختيار في `parseProgressFile` (`js/app.js:612`): يُستخدم `root.state` إن كان كائنًا غير مصفوفة، وإلا `root` نفسه. ثم تُستخدم `src.ayahs` إن كانت **مصفوفة**، وإلا `root.ayahs` إن كانت مصفوفة (`js/app.js:618`). **إن كانت إحداهما مصفوفة فهي المرجع ويُتجاهل أي `read` مكرر** (`js/app.js:620-623`).

### 9.2 جدول التحقق

| المرحلة | القاعدة | النتيجة عند الفشل |
|---|---|---|
| بنية الملف | كائن JSON غير مصفوفة | رفض: «بنية الملف غير معروفة…» |
| `JSON.parse` | نص صالح | رفض: «الملف ليس JSON صالحًا…» |
| `version` | `≤ 2` أو غائب | رفض: «هذا الملف من نسخة أحدث من التطبيق…» (`js/app.js:613-615`) |
| وجود بيانات | `ayahs` مصفوفة، أو `read` كائن عند غياب `ayahs` | رفض: «الملف لا يحتوي بيانات قراءة صالحة (ayahs أو read)» |
| v2 `ayahs` | مصفوفة، طول `≤ 6236` | رفض |
| عنصر `ayahs` | كائن غير مصفوفة | رفض |
| `surah`/`ayah` | `number` + `Number.isInteger` | رفض |
| الفهرس | السورة موجودة و`1 ≤ ayah ≤ meta.ayahs` | رفض |
| التكرار | لا مفتاح `"سورة:آية"` مكرر | رفض |
| `date` | `null`/مفقود → `true`، أو `YYYY-MM-DD` حقيقي لا يتجاوز الغد | رفض |
| v1 `read` | كائن غير مصفوفة، `≤ 6236` مفتاحًا | رفض |
| مفتاح v1 | `^\d{1,3}:\d{1,3}$` وداخل الفهرس | رفض |
| قيمة v1 | `true` أو تاريخ حقيقي لا يتجاوز الغد | رفض |
| `last` | إن وُجد: سورة موجودة وآية صحيحة | رفض الملف كاملًا |
| `khatmaCount` | عدد صحيح `≥ 0` | يصبح `0` بلا رفض |
| `dailyGoal` | رقم صالح → `1-500` (مقرّب) | `20` |
| `fontSize` | رقم صالح → `1.2-3` | `1.9` |
| `theme` | `dark`/`light`/`null` | `null` |
| `log` | كائن؛ كل يوم صالح ولا يتجاوز الغد؛ العدد صحيح `0-6236` | يُسقَط اليوم المعطوب فقط |
| `exportedAt` | `Date.parse` صالح | `null` |
| حجم الملف | `≤ 5MB` في `handleImportFile` (`js/app.js:866`) | رفض قبل القراءة |

> **الغد مقبول:** `isFutureDay` (`js/app.js:375-379`) يبني مفتاح الغد ثم يرفض ما هو **أكبر منه** فقط (`value > dateKeyOf(tomorrow)`). لذلك تاريخ اليوم والغد مقبولان، وما بعد الغد مرفوض. هذا سلوك الدالة الحالي وليس وعدًا بأن الغد «مستقبلي» بالاسم.

### 9.3 بناء `incoming`

بعد نجاح التحقق يُبنى كائن داخلي فقط:

```js
{
  read,          // خريطة "سورة:آية" → تاريخ | true
  last,          // {surah, ayah, name} أو null
  khatmaCount,
  dailyGoal,
  fontSize,
  theme,
  log,           // منظف
  exportedAt     // ISO أو null
}
```

`summary` و`timezone` و`source` و`device` لا تدخل `incoming`. يُبنى منها `meta` منفصل للعرض (`js/app.js:678-685`):

- `version`: رقم صالح أو `1`.
- `appVersion`: نص مقصوص 24 حرفًا.
- `exportedAt`: نص مقصوص 40 حرفًا.
- `exportedAtLocal`: نص مقصوص 32 حرفًا.
- `source`: فقط إن كان `kind` ضمن `SOURCE_LABELS`؛ `origin` مقصوص 200 حرف. وإلا `null`.
- `device`: فقط إن كان كائنًا؛ `label` 80، `platform` 40، `model` 40، `browser` 40، `language` 24. وإلا `null`.

### 9.4 سطر المعاينة

`describeImportMeta` (`js/app.js:704-713`) يبني اختياريًا:

```text
الملف من: Pixel 7 • Android 14 (ويب) — أُنشئ: 2026-10-19 14:12:05.
```

- يظهر الجزء المتاح فقط؛ إن غاب كل شيء يرجع نصًا فارغًا.
- الترجمة من `SOURCE_LABELS` (`js/app.js:363`): `محلي` / `ويب` / `مثبت` / `APK`.
- يظهر قبل نص المعاينة، ولا يدخل الحالة.

### 9.5 رفض v3

```text
version > 2  →  «هذا الملف من نسخة أحدث من التطبيق. حدّث الصفحة ثم أعد المحاولة.»
```

لا محاولة تفسير صامت ولا استيراد جزئي. غياب `version` لا يُرفض ويُعامل كملف v1/قديم.

## 10. الدمج والاستبدال والتراجع

### 10.1 الدمج (merge)

| الحقل | القاعدة |
|---|---|
| `read` | اتحاد الخريطتين؛ عند تعارض المفتاح يبقى **أقدم تاريخ**. القيمة `true` تُستبدل بأي تاريخ وارد، والتاريخ المحلي لا يُستبدل بـ `true` (`mergeRead` في `js/app.js:728-737`) |
| `khatmaCount` | `Math.max(المحلي, الوارد)` |
| `last` | المحلي إن وُجد (`state.last \|\| incoming.last`) |
| `dailyGoal` / `fontSize` / `theme` | تبقى محلية بلا تغيير |
| `lastExportAt` | لا يتغير |
| `log` | يُعاد حسابه من تواريخ `read` المدمجة، ثم لكل يوم يُؤخذ `Math.max` مع المحلي والوارد والمحسوب (`mergeLog` في `js/app.js:740-751`) — فلا ينقص سجل سابق ولا يتضاعف |

### 10.2 الاستبدال (replace)

| الحقل | القاعدة |
|---|---|
| `read` | من الملف فقط |
| `khatmaCount` / `last` / `dailyGoal` / `fontSize` / `theme` | من الملف |
| `log` | `mergeLog({}, incoming.log, incoming.read)` — أي يُعاد حسابه من `read` ثم `max` مع `log` الملف، **وليس نسخًا حرفيًا** |
| `lastExportAt` | `incoming.exportedAt` (قد يكون `null`) |

### 10.3 نسخة الأمان والتراجع

1. قبل أي تعديل تُنسخ الحالة السابقة عميقًا في الذاكرة (`js/app.js:792`).
2. تُكتب النسخة في `localStorage` تحت `quran_tracker_backup_v1` بالشكل:

   ```json
   { "savedAt": "2026-10-19T09:12:00.000Z", "state": { "…": "شكل quran_tracker_v1" } }
   ```

   (`js/app.js:816`). إن امتلأ التخزين يكمل الاستيراد بلا نسخة تراجع بدل إفشاله.
3. يُنفَّذ الدمج أو الاستبدال، ثم `saveState` وإعادة رسم كل الواجهة (`refreshAfterImport` في `js/app.js:754-762`).
4. يظهر زر «تراجع عن الاستيراد» **10 ثوانٍ** (`js/app.js:827-829`)، لكن النسخة تبقى في `localStorage` بعد انتهاء المهلة حتى استيراد تالٍ أو تراجع يدوي.
5. `undoImport` (`js/app.js:833-852`) يستعيد `{...defaultState(), ...backup.state}`، يحذف النسخة، ويخفي الزر.

### 10.4 ما لا يحدث بعد الاستيراد

- **لا يُستدعى `checkKhatmaComplete`** — الاستيراد ليس قراءة جديدة، فلا ختمة وهمية.
- لا تغيير في شكل `localStorage`: يبقى `state.read` خريطة `"سورة:آية" → تاريخ|true`.
- لا كتابة لـ `ayahs` في الحالة المحلية؛ هي موجودة في الملف فقط.

## 11. التوافق مع v1

| الجانب | v1 | v2 |
|---|---|---|
| التقدم | `state.read` خريطة `"سورة:آية" → تاريخ \| true` | `state.ayahs` قائمة مرتبة `[{surah, ayah, date}]` |
| القيمة بلا تاريخ | `true` | `{date: null, legacy: true}` عند التصدير، وتُستورد `true` |
| الغلاف | `app/kind/version/exportedAt/state` | يضيف `appVersion`/`exportedAtLocal`/`timezone`/`source`/`device`/`summary` |
| الاستيراد | مقبول دائمًا | مقبول، و`ayahs` تتجاوز `read` إن كانت مصفوفة |
| `read` المكرر | هو المصدر | يُتجاهل إن كانت `ayahs` مصفوفة |

- التطبيق الحالي يقبل v1 بالكامل ويحوّله داخليًا إلى `read`.
- لا يُدّعى أن النسخ الأقدم من التطبيق تقرأ v2؛ الاتجاه المدعوم هو التطبيق الحالي ← ملفات قديمة.
- `true` تبقى تعمل كـ truthy، لكن تراجعها لا يُنقص عدّاد اليوم لأن لا تاريخ لها (سلوك مقصود وموثق).

## 12. الخصوصية

- **محلي بالكامل:** التصدير ينشئ `Blob` وينزّله (`js/app.js:582-593`)؛ الاستيراد يقرأ ملفًا اختاره المستخدم (`file.text()` في `js/app.js:877`). لا `fetch` ولا رفع ولا تحليلات.
- **حساسية الملف:** يحتوي تقدم القراءة وعدد الختمات والورد اليومي، إضافة إلى وصف الجهاز (`label/platform/model/browser`)، والمنطقة الزمنية، وأصل الموقع (`origin`). عامل الملف كبيانات شخصية ولا تشاركه علنًا بلا داعٍ.
- **لا يُرسل إلى أي خادم** حتى عند فتح التطبيق: كل الحالة في `localStorage` فقط (`quran_tracker_v1` + `surah_cache_*` + `quran_tracker_backup_v1`).
- **الوصفي للتشخيص فقط:** `source`/`device`/`timezone` تساعد المستخدم على تمييز نسخة جهاز عن آخر في المعاينة، ولا تُستخدم لأي تتبع.

## 13. الحدود

| الحد | القيمة | الموضع |
|---|---|---|
| حجم ملف الاستيراد | 5MB | `PROGRESS_MAX_BYTES` (`js/app.js:361`) و`handleImportFile` (`js/app.js:866`) |
| عدد الآيات في الملف | 6236 | `ayahsToRead` (`js/app.js:487`) ومسار v1 (`js/app.js:630`) |
| أعلى إصدار صيغة مقبول | 2 | `js/app.js:613` |
| صيغة التاريخ | `YYYY-MM-DD` حقيقي | `isDayString` (`js/app.js:368-373`) |
| التواريخ المستقبلية | مرفوضة بعد الغد (اليوم والغد مقبولان) | `isFutureDay` (`js/app.js:375-379`) |
| الهدف اليومي | 1-500 (مقرّب) | `js/app.js:693` |
| حجم الخط | 1.2-3 rem | `js/app.js:694` |
| `khatmaCount` | عدد صحيح `≥ 0` | `js/app.js:692` |
| قيم `log` | أعداد صحيحة 0-6236 | `sanitizeLog` (`js/app.js:716-725`) |
| مفتاح v1 | `^\d{1,3}:\d{1,3}$` | `js/app.js:635` |
| اسم الملف | `noor-progress-YYYY-MM-DD-HHmmss.json` | `js/app.js:589` |

## 14. إصدار الصيغة وإصدار التطبيق

- `version` = **2**: إصدار الصيغة. أي تغيير جوهري في الشكل يرفعه، ويجب أن يرفض الاستيراد ما هو أعلى منه.
- `appVersion` = **1.0.0**: إصدار التطبيق المنشور؛ وصفي ولا يمنع الاستيراد.
- `SW_CACHE` = **`noor-v1.0.1`** في `sw.js:4`: مخطط `noor-vMAJOR.MINOR.PATCH`، ويُرفع الـ patch مع كل commit يمس أي ملف في `CORE` حتى يصل التحديث للمستخدمين. لا علاقة مباشرة له بصيغة الملف.
