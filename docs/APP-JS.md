# توثيق `js/app.js` — نور: مصحف الختمة

> شرح شفرة `app.js` فقط (1251 سطرًا). كل رقم سطر يشير إلى الملف الحالي. لا يصف المشروع عامة — راجع `README.md` لذلك.
> صيغة ملف نقل التقدم v2 موثقة تفصيلًا في `docs/PROGRESS-FILE.md`.

## 1. نظرة سريعة

- `js/app.js` هو كل منطق التطبيق (Vanilla JS بلا اعتماديات): يحمّل فهرس 114 سورة من `data/surahs.json` ويرسمه في `#surahList` (`init` سطر 1216).
- هيكل `index.html` الحالي: `div.app` (سطر 54) بشبكة عمودين — `aside.sidebar#sidebar` (سطر 56: بحث `#search` سطر 61 + فهرس `.index/#surahList` سطر 80) + `main.reading#main` (سطر 85: شريط المتابعة `#trackStrip` سطر 87 ثم بطاقة `.daily` لآية اليوم سطر 89 ثم `div.reading-row` سطر 93 بقارئ `article.mushaf/#reader` وبطاقة `aside.progress#progress` سطر 121 بجانبه). لا `hero` ولا `dashboard` ولا `layout` قديمة.
- يجلب نص السور بترتيب ثابت: كاش `localStorage` ← `window.OFFLINE_SURAHS` ← API `api.alquran.cloud` (`loadSurahAyahs` سطر 202).
- التعليم آية آية بالنقر يبدّل `state.read` بمفاتيح `"سورة:آية"` ويحدّث `state.log` اليومي و`state.last` (`toggleAyahRead` سطر 124).
- الإحصاء كله مشتق: النسبة = `readTotal() / TOTAL_AYAS` وتُرسم في `renderStats` (سطر 928).
- كل الحالة تُحفظ في مفتاح واحد `quran_tracker_v1` عبر `saveState` (سطر 67) بعد كل تغيير.
- العلوية `header.topbar` (سطر 30): الشعار + رابط إنستغرام `a.brand-link` (سطر 38) + روابط الأقسام `nav.top-links` (سطر 40: `#sidebar` للفهرس و`#reader` للقراءة و`#progress` للختمة) + شارة `#netStatus` (سطر 46) + زر الثيم `#themeToggle` (سطر 49)؛ زرّا الخط في `.reader-font` برأس القارئ (`index.html:104-107`).
- نقل التقدم: ملف JSON بصيغة v2 (`PROGRESS_FORMAT` سطر 358) يحمل `state.ayahs` مرتبة بدل خريطة `read`، مع غلاف وصفي (`appVersion`/`exportedAtLocal`/`timezone`/`source`/`device`/`summary`) لا يدخل الحالة. التصدير `exportProgress` (سطر 582)، والاستيراد `parseProgressFile` (سطر 601) ثم `applyImport` (سطر 791).

## 2. الثوابت

| الاسم | السطر | القيمة / الشكل | لماذا موجود | أين يُستخدم |
|---|---|---|---|---|
| `TOTAL_AYAS` | 7 | `6236` | أساس حساب نسبة الختمة والمتبقي (مجموع `data/surahs.json`) | `resetKhatma` (334، 337، 340)؛ `buildSummary` (542-544)؛ `renderStats` (930، 932)؛ `checkKhatmaComplete` (956)؛ `ayahsToRead` (487-488)؛ `parseProgressFile` (631) |
| `KHATMA_RESET_MARGIN` | 9 | `10` | مرجع تاريخي لعتبة القرب من الإتمام (6226 فأكثر) — لا يُحتسب شيء تلقائيًا، الاحتساب يتطلب تعليم الصندوق في `resetKhatma` | تعليق توثيقي فقط (سطر 8)؛ المنطق الفعلي في `resetKhatma` (335-341) يعتمد إقرارًا صريحًا لا العتبة |
| `LS_KEY` | 10 | `'quran_tracker_v1'` | مفتاح حالة الختمة في `localStorage` — ثابت حتى لا تضيع بيانات المستخدمين | `loadState` (59)؛ `saveState` (68) |
| `BACKUP_KEY` | 12 | `'quran_tracker_backup_v1'` | نسخة أمان تُكتب قبل كل استيراد ويعيدها زر «تراجع» | `applyImport` (816)؛ `undoImport` (836-847) |
| `CACHE_PREFIX` | 13 | `'surah_cache_'` | بادئة مفاتيح نص السور (`surah_cache_<number>`) | `getCachedAyahs` (80)؛ `saveSurahCache` (89)؛ `cachedSurahCount` (1062) |
| `OFFLINE_SURAHS` | 14 | `window.OFFLINE_SURAHS \|\| {}` (من `js/offline-surahs.js`: السور 1، 112، 113، 114) | العمل دون إنترنت للسور المضمّنة قبل أي جلب | `loadSurahAyahs` (205-208) |
| `PROGRESS_FORMAT` | 358 | `2` | نسخة صيغة ملف التصدير — تُرفع عند تغيير شكل الملف؛ الاستيراد يرفض ما هو أعلى منها (613-615) | `collectProgress` (561)؛ `parseProgressFile` (613) |
| `APP_VERSION` | 360 | `'1.0.0'` | إصدار التطبيق المعلن داخل الملف — **وصفي فقط** ولا يدخل الحالة | `collectProgress` (562)؛ `parseProgressFile` (680) داخل `meta` |
| `PROGRESS_MAX_BYTES` | 361 | `5 * 1024 * 1024` | سقف حجم ملف الاستيراد (5MB) | `handleImportFile` (866) |
| `SOURCE_LABELS` | 363 | `{ localhost: 'محلي', web: 'ويب', pwa: 'مثبت', apk: 'APK' }` | ترجمة أنواع المصدر في معاينة الاستيراد ومنع أي نوع خارج القائمة | `parseProgressFile` (670)؛ `describeImportMeta` (706) |

## 3. متغيرات الحالة

| الاسم | السطر | النوع / الشكل | الدوال التي تقرؤه | الدوال التي تغيّره | لماذا |
|---|---|---|---|---|---|
| `surahs` | 18 | `Array<{number, name, english, ayahs, type}>` — فارغ ثم 114 عنصرًا | `findSurah` (73)؛ `renderList` (186)؛ `openSurah` (261)؛ `completeCurrentSurah` (312)؛ `updateSurahBadge` (147)؛ `buildSummary` (539)؛ `ayahsToRead` (502) | `init` (1220) فقط | فهرس السور من `data/surahs.json` — مصدر أسماء وأعداد الآيات في كل الرسم |
| `state` | 19 | `{read: {[key]: date\|true}, last: {surah,ayah,name}\|null, khatmaCount: number, dailyGoal: number, fontSize: number, log: {[YYYY-MM-DD]: number}, theme: 'dark'\|'light'\|null, lastExportAt: string\|null}` | كل دوال القراءة والإحصاء تقريبًا (`readTotal`، `readCountOf`، `renderStats`، `bindEvents/setGoal`) | `loadState` (تهيئة أولى)؛ `markAyahRead` (118-120)؛ `toggleAyahRead` (129-131)؛ `completeCurrentSurah` (325-326)؛ `resetKhatma` (345-347)؛ `checkKhatmaComplete` (957-959)؛ `toggleTheme` (910)؛ `changeFontSize` (917)؛ `bindEvents/setGoal` (1136)؛ `exportProgress` (594)؛ `applyImport` (818)؛ `undoImport` (845) | الحالة الوحيدة القابلة للحفظ — تُكتب كاملة في `localStorage` عبر `saveState` |
| `currentSurah` | 20 | `number \| null` — رقم السورة المعروضة | `renderList` (192 لتحديد `active`)؛ `completeCurrentSurah` (311-314)؛ `resetKhatma` (352)؛ `checkKhatmaComplete` (963)؛ أزرار السابق/التالي في `bindEvents` (1179-1184) | `openSurah` (260) فقط | يتتبع السورة المفتوحة: حارس السباق (`currentSurah !== number` سطر 277، 282) وتمكين زر الإتمام والتنقل |
| `$` | 23 | `(id: string) => HTMLElement` — اختصار `document.getElementById` | كل الدوال التي تلمس DOM | لا يُغيَّر (ثابت سهمي) | تقليل التكرار — يقبل `id` دون `#` |
| `pendingImportMode` | 364 | `'merge' \| 'replace'` | `handleImportFile` (887) | `pickImportFile` (856) | الوضع المختار قبل فتح منتقي الملف — يحدد المعاينة والتنفيذ |
| `undoTimer` | 365 | `timeoutId \| null` | `applyImport` (826، 827-829)؛ `undoImport` (848) | `applyImport` (827) | مؤقت إخفاء زر التراجع بعد 10 ثوانٍ — يُصفَّر قبل كل استيراد |
| `cacheBarTimer` | 1055 | `timeoutId \| null` | `hideCacheBar` (1079)؛ `showCacheBar` (1107) | `hideCacheBar` (1079-1080)؛ `showCacheBar` (1107) | مؤقت إخفاء شريط السور المحفوظة بعد 5 ثوانٍ — يُصفَّر قبل إنشاء شريط جديد لمنع التراكم |

## 4. الدوال بالترتيب

### `pad2(n)` — سطر 26

- **التوقيع:** `function pad2(n)`
- **ماذا تفعل وكيف:** تحوّل الرقم إلى نص بـ `String(n)` وتضيف صفرًا بادئًا حتى منزلتين عبر `padStart(2, '0')` (سطر 27).
- **لماذا وُجدت:** أساس موحد لكل طوابع التاريخ (`YYYY-MM-DD`) والوقت (`HH:mm:ss`) والإزاحة الزمنية.
- **المدخلات:** عدد أو نص رقمي. **المخرجات:** نص منزلتين.
- **تناديها:** `dateKeyOf` (32)؛ `localStamp` (404)؛ `timezoneInfo` (416). **تنادي:** لا شيء.

### `dateKeyOf(date)` — سطر 31

- **التوقيع:** `function dateKeyOf(date)`
- **ماذا تفعل وكيف:** تبني `${getFullYear()}-${pad2(getMonth()+1)}-${pad2(getDate())}` (سطر 32) — توقيت المتصفح المحلي لا UTC.
- **لماذا وُجدت:** مفتاح يوم محلي واحد لكل السجل والطوابع، بدل تكرار بناء التاريخ.
- **المدخلات:** كائن `Date`. **المخرجات:** نص `YYYY-MM-DD`.
- **تناديها:** `todayKey` (37)؛ `isFutureDay` (378)؛ `localStamp` (404)؛ `buildSummary` (534). **تنادي:** `pad2`.

### `todayKey()` — سطر 36

- **التوقيع:** `function todayKey()`
- **ماذا تفعل وكيف:** ترجع `dateKeyOf(new Date())` (سطر 37).
- **لماذا وُجدت:** مفتاح `state.log` اليومي بتوقيت المتصفح المحلي — عدّاد ورد اليوم.
- **المدخلات:** لا شيء.
- **المخرجات والتأثيرات:** ترجع نص `YYYY-MM-DD`؛ لا DOM ولا تخزين.
- **تناديها:** `markAyahRead` (117)؛ `completeCurrentSurah` (318)؛ `renderStats` (936، 948)؛ `buildSummary` (525). **تنادي:** `dateKeyOf`.

### `debounce(fn, ms = 200)` — سطر 41

- **التوقيع:** `function debounce(fn, ms = 200)`
- **ماذا تفعل وكيف:** تحجز `timer` (42)؛ ترجع دالة سهمية تمسح المؤقت السابق `clearTimeout` (44) وتضبط `setTimeout(() => fn(...args), ms)` (45).
- **لماذا وُجدت:** تقليل إعادة رسم الفهرس أثناء الكتابة في `#search`.
- **المدخلات:** `fn` الدالة المؤجلة، `ms` المهلة (افتراضي 200).
- **المخرجات والتأثيرات:** ترجع دالة مؤجلة؛ لا DOM مباشر.
- **تناديها:** `bindEvents` (1149) للفّ `renderList`. **تنادي:** `fn` الممررة.

### `defaultState()` — سطر 53

- **التوقيع:** `function defaultState()`
- **ماذا تفعل وكيف:** ترجع كائنًا جديدًا `{read:{}, last:null, khatmaCount:0, dailyGoal:20, fontSize:1.9, log:{}, theme:null, lastExportAt:null}` (سطر 54) — كائن جديد كل استدعاء حتى لا تتشارك النسخ المرجع نفسه.
- **لماذا وُجدت:** مرجع واحد للقيم الافتراضية في `loadState` والتراجع عن الاستيراد، وأي حقل جديد يُضاف هنا أولًا.
- **المدخلات:** لا شيء. **المخرجات:** حالة فارغة صالحة.
- **تناديها:** `loadState` (60، 62)؛ `undoImport` (845). **تنادي:** لا شيء.

### `loadState()` — سطر 57

- **التوقيع:** `function loadState()`
- **ماذا تفعل وكيف:** تحاول `JSON.parse(localStorage.getItem(LS_KEY))` (59) وتدمج `{...defaultState(), ...saved}` (60)؛ عند أي استثناء ترجع `defaultState()` (62).
- **لماذا وُجدت:** التوافق مع البيانات القديمة الناقصة — الدمج يحمي المفاتيح الغائبة.
- **المدخلات:** لا شيء (تقرأ `localStorage`).
- **المخرجات والتأثيرات:** ترجع كائن الحالة؛ تقرأ `localStorage` فقط.
- **تناديها:** تهيئة `state` (سطر 19). **تنادي:** `defaultState`، `localStorage.getItem`، `JSON.parse`.

### `saveState()` — سطر 67

- **التوقيع:** `function saveState()`
- **ماذا تفعل وكيف:** سطر واحد: `localStorage.setItem(LS_KEY, JSON.stringify(state))` (سطر 68).
- **لماذا وُجدت:** نقطة الكتابة الوحيدة للحالة — تُستدعى بعد كل تغيير (تعليق سطر 66).
- **المدخلات:** لا شيء (تقرأ `state` العامة).
- **المخرجات والتأثيرات:** تكتب `quran_tracker_v1` في `localStorage`؛ لا ترجع شيئًا.
- **تناديها:** `refreshAyahUI` (139)؛ `resetKhatma` (348)؛ `checkKhatmaComplete` (960)؛ `toggleTheme` (911)؛ `changeFontSize` (918)؛ `bindEvents/setGoal` (1138)؛ `exportProgress` (595)؛ `applyImport` (819)؛ `undoImport` (846).

### `findSurah(number)` — سطر 72

- **التوقيع:** `function findSurah(number)`
- **ماذا تفعل وكيف:** `surahs.find((s) => s.number === number)` (سطر 73).
- **لماذا وُجدت:** جلب بيانات سورة من الفهرس برقمها في كل موضع يحتاج الاسم/العدد/النوع.
- **المدخلات:** `number` رقم السورة.
- **المخرجات:** كائن السورة أو `undefined`.
- **تناديها:** `updateSurahBadge` (147)؛ `openSurah` (261)؛ `completeCurrentSurah` (312)؛ `resetKhatma` (ضمنيًا)؛ `ayahsToRead` (502)؛ `parseProgressFile` (637، 654). **تنادي:** لا شيء.

### `getCachedAyahs(number)` — سطر 78

- **التوقيع:** `function getCachedAyahs(number)`
- **ماذا تفعل وكيف:** تحاول `JSON.parse(localStorage.getItem(CACHE_PREFIX + number))` (80) وترجع `cached?.ayahs` (81)؛ عند الفشل ترجع `null` (83).
- **لماذا وُجدت:** قراءة نص السورة المحفوظ بعد أول تحميل — الخطوة 1 من `loadSurahAyahs`.
- **المدخلات:** `number` رقم السورة.
- **المخرجات:** `[{number, text}]` أو `null`؛ تقرأ `localStorage` فقط.
- **تناديها:** `loadSurahAyahs` (203)؛ `completeCurrentSurah` (314 لحساب `total` دون شبكة).

### `saveSurahCache(number, ayahs)` — سطر 88

- **التوقيع:** `function saveSurahCache(number, ayahs)`
- **ماذا تفعل وكيف:** تكتب `{ayahs}` في `CACHE_PREFIX + number` (89) ثم تنادي `updateCacheBar()` (90) لتحديث نص زر الـ footer.
- **لماذا وُجدت:** حفظ النص بعد أول جلب ناجح ليعمل دون إنترنت + إبقاء عدّاد الزر حيًا.
- **المدخلات:** `number`، و`ayahs` مصفوفة `[{number, text}]`.
- **المخرجات والتأثيرات:** كتابة `localStorage` + تحديث DOM عبر `updateCacheBar`.
- **تناديها:** `loadSurahAyahs` (206 للـ offline، 213 للـ API). **تنادي:** `updateCacheBar`.

### `readTotal()` — سطر 94

- **التوقيع:** `function readTotal()`
- **ماذا تفعل وكيف:** `Object.keys(state.read).length` (سطر 95).
- **لماذا وُجدت:** إجمالي المقروء في الختمة الحالية — أساس النسبة والمتبقي وكشف الاكتمال.
- **المدخلات:** لا شيء. **المخرجات:** عدد صحيح.
- **تناديها:** `resetKhatma` (333)؛ `buildSummary` (524)؛ `renderStats` (929)؛ `checkKhatmaComplete` (956)؛ `showImportPreview` (769). **تنادي:** لا شيء.

### `readCountOf(surahNumber)` — سطر 99

- **التوقيع:** `function readCountOf(surahNumber)`
- **ماذا تفعل وكيف:** تبني بادئة `"N:"` (100) وترشّح مفاتيح `state.read` التي تبدأ بها ثم تعدّها (101).
- **لماذا وُجدت:** عدّاد كل سورة على حدة (شارة الفهرس + حساب غير المقروء في الإتمام + السور المكتملة في الملخص).
- **المدخلات:** `surahNumber`. **المخرجات:** عدد آيات تلك السورة المقروءة.
- **تناديها:** `updateSurahBadge` (149)؛ `renderList` (187)؛ `completeCurrentSurah` (316)؛ `buildSummary` (539). **تنادي:** لا شيء.

### `surahStatusText(meta, readCount)` — سطر 106

- **التوقيع:** `function surahStatusText(meta, readCount)`
- **ماذا تفعل وكيف:** تبني `["N آية", type]` (107)؛ إن `readCount >= ayahs` تدفع `'✔'` (108) وإلا إن `> 0` تدفع `"r/N"` (109)؛ تدمج بـ `' • '` (110).
- **لماذا وُجدت:** نص `<small>` الموحد في كل عنصر فهرس.
- **المدخلات:** `meta` بيانات السورة، `readCount`. **المخرجات:** نص عربي. لا تأثيرات.
- **تناديها:** `updateSurahBadge` (150)؛ `renderList` (193).

### `markAyahRead(surahNumber, ayahNumber, surahName)` — سطر 114

- **التوقيع:** `function markAyahRead(surahNumber, ayahNumber, surahName)`
- **ماذا تفعل وكيف:** تبني المفتاح `"S:A"` (115)؛ إن موجود ترجع فورًا (116 — تمنع تضخيم عدّاد اليوم)؛ وإلا تخزن `state.read[key] = todayKey()` (118) وتضبط `state.last` (119) وتزيد `state.log[today]` (120).
- **لماذا وُجدت:** التعليم الأحادي الاتجاه (يستخدمه النقر الثاني والحلقات الجماعية) — القيمة تاريخ نصي (truthy) لإنقاص عدّاد اليوم الصحيح عند التراجع.
- **المدخلات:** أرقام السورة والآية واسم السورة. **المخرجات:** لا شيء؛ تغيّر `state` في الذاكرة فقط (الحفظ على المتصل عبر `refreshAyahUI`).
- **تناديها:** `toggleAyahRead` (134)؛ `completeCurrentSurah` (325 في حلقة). **تنادي:** `todayKey`.

### `toggleAyahRead(surahNumber, ayahNumber, surahName)` — سطر 124

- **التوقيع:** `function toggleAyahRead(surahNumber, ayahNumber, surahName)`
- **ماذا تفعل وكيف:** إن المفتاح موجود: تقرأ يومه `day` (128)؛ إن كان نصًا و`state.log[day] > 0` تنقصه (129 — القيم القديمة `true` بلا يوم تُتجاهل عمدًا)؛ تحذف المفتاح (130)؛ وتصفّر `last` إن كانت هي نفس الآية (131) ثم ترجع (132)؛ وإلا تنادي `markAyahRead` (134).
- **لماذا وُجدت:** تبديل النقرة (تعليم ← تراجع) مع الحفاظ على سلامة عدّاد اليوم وآخر قراءة، ودعم بيانات `true` القديمة.
- **المدخلات/المخرجات:** كالسابقة؛ تغيّر `state` في الذاكرة فقط.
- **تناديها:** معالج `onclick` في `createAyahElement` (246). **تنادي:** `markAyahRead`.

### `refreshAyahUI(surahNumber)` — سطر 138

- **التوقيع:** `function refreshAyahUI(surahNumber)`
- **ماذا تفعل وكيف:** `saveState()` (139) ثم `renderStats()` (140) ثم `updateSurahBadge(surahNumber)` (141).
- **لماذا وُجدت:** خط الأنابيب الموحد بعد كل تعليم/تراجع — حفظ + إحصاء + شارة دون إعادة رسم القائمة كاملة (أداء).
- **تناديها:** معالج النقر في `createAyahElement` (247)؛ `completeCurrentSurah` (327). **تنادي:** الثلاثة المذكورة.

### `updateSurahBadge(surahNumber)` — سطر 145

- **التوقيع:** `function updateSurahBadge(surahNumber)`
- **ماذا تفعل وكيف:** تجد زر الفهرس `[data-surah="N"]` (146) و`meta` (147)؛ إن غاب أحدهما ترجع (148)؛ تحسب `readCountOf` (149) وتحدّث `<small>` عبر `surahStatusText` (150) وتبدّل صنف `done` (151).
- **لماذا وُجدت:** تحديث شارة سورة واحدة فقط — تجنّب `renderList` الكاملة عند كل نقرة.
- **التأثيرات:** تعديل DOM موضعي فقط.
- **تناديها:** `refreshAyahUI` (141). **تنادي:** `findSurah`، `readCountOf`، `surahStatusText`.

### `normalizeArabic(s)` — سطر 155

- **التوقيع:** `function normalizeArabic(s)`
- **ماذا تفعل وكيف:** سلسلة `replace`: همزات `[أإآ]` ← `ا`، `ة` ← `ه`، `ى` ← `ي`، حذف التشكيل `[ً-ٟ]` (سطر 156).
- **لماذا وُجدت:** ليجد «ابراهيم» سورة «إبراهيم» — مطابقة متسامحة.
- **تناديها:** `surahMatches` (173). **تنادي:** لا شيء.

### `normalizeDigits(s)` — سطر 160

- **التوقيع:** `function normalizeDigits(s)`
- **ماذا تفعل وكيف:** تحوّل المشرقية `[٠-٩]` والفارسية `[۰-۹]` إلى لاتينية عبر `indexOf` (161)؛ تجرّد المسافات `trim` (162) والأصفار البادئة `^0+` (163).
- **لماذا وُجدت:** ليجد «٠١٨» أو « 18 » السورة 18.
- **تناديها:** `surahMatches` (170). **تنادي:** لا شيء.

### `surahMatches(meta, query)` — سطر 167

- **التوقيع:** `function surahMatches(meta, query)`
- **ماذا تفعل وكيف:** إن لا استعلام ترجع `true` (168)؛ تحسب `q` الصغيرة (169) و`nq` المطبّعة رقميًا (170) و`isNumeric` (171)؛ ترجع OR: عربي مطبّع `includes` (173) أو إنجليزي `includes` غير حساس (174) أو رقم مطابق تمامًا `String(number) === nq` (175).
- **لماذا وُجدت:** منطق المطابقة الثلاثي (عربي/إنجليزي/رقم) للبحث الجانبي.
- **تناديها:** `renderList` (186). **تنادي:** `normalizeArabic`، `normalizeDigits`.

### `renderList(filter = '')` — سطر 180

- **التوقيع:** `function renderList(filter = '')`
- **ماذا تفعل وكيف:** تفرّغ `#surahList` (181-182)؛ تقصّ الفلتر (183)؛ تنشئ `DocumentFragment` (184)؛ ترشّح بـ `surahMatches` (186) ولكل سورة: تحسب المقروء و`done` (187-188)، تنشئ `<button data-surah>` بأصناف `surah-item/active/done` (189-192)، تحشو `innerHTML` (رقم + `سورة name` + `<small>` الحالة + ✔) (193)، تربط `onclick → openSurah` (194)؛ تلحق الكل دفعة واحدة (195، 198).
- **لماذا وُجدت:** رسم الفهرس دفعة واحدة لتقليل إعادة التدفق (أداء).
- **التأثيرات:** إعادة بناء `#surahList` كاملة.
- **تناديها:** `bindEvents` عبر البحث (1149)؛ `resetKhatma` (350)؛ `checkKhatmaComplete` (962)؛ `refreshAfterImport` (758)؛ `init` (1227). **تنادي:** `surahMatches`، `readCountOf`، `surahStatusText`، `openSurah` (عبر النقر).

### `loadSurahAyahs(number)` — سطر 202

- **التوقيع:** `async function loadSurahAyahs(number)`
- **ماذا تفعل وكيف:** (1) كاش → ترجعه (203-204)؛ (2) `OFFLINE_SURAHS[number]` → يحفظه `saveSurahCache` ويرجعه (205-208)؛ (3) `fetch(api.alquran.cloud/v1/surah/N/quran-uthmani)` (209)؛ إن `!ok` يرمي (210)؛ يحوّل `json.data.ayahs` إلى `[{number: numberInSurah, text}]` (212) ويحفظه (213) ويرجعه (214).
- **لماذا وُجدت:** ترتيب المصادر الثابت: محلي أولًا ثم مضمّن ثم الرسمي (طبعة `quran-uthmani` لا تُغيَّر دون طلب).
- **تناديها:** `openSurah` (274). **تنادي:** `getCachedAyahs`، `saveSurahCache`، `fetch`.

### `stripBasmalaPrefix(text)` — سطر 219

- **التوقيع:** `function stripBasmalaPrefix(text)`
- **ماذا تفعل وكيف:** تقسّم كلمات (220)؛ تأخذ أول 4 كلمات وتطبّعها (`ٱ`←`ا` وحذف التشكيل) (221)؛ إن طابقت `بسم الله الرحمن الرحيم` ترجع الباقي (223) وإلا الأصل (224).
- **لماذا وُجدت:** الـ API يُبقي البسملة في الآية 1 والعرض يضع بسملة خضراء زخرفية — التجريد يمنع التكرار. نسخة عرض فقط، الكاش لا يُمس. تُستخدم للسور عدا 1 و9.
- **تناديها:** `openSurah` (294).

### `highlightActiveSurah(number)` — سطر 227

- **التوقيع:** `function highlightActiveSurah(number)`
- **ماذا تفعل وكيف:** تزيل `active` عن الكل (228) وتضيفها لـ `[data-surah="N"]` مع `?.` الآمن (229).
- **لماذا وُجدت:** إبراز السورة المفتوحة في الفهرس.
- **تناديها:** `openSurah` (266).

### `createAyahElement(surahNumber, surahName, ayah)` — سطر 233

- **التوقيع:** `function createAyahElement(surahNumber, surahName, ayah)`
- **ماذا تفعل وكيف:** تبني المفتاح (234) وتحسب `isLast` (235)؛ تنشئ `<span.ayah>` بأصناف `read` و`last` (الثانية فقط إن مقروءة أيضًا) (237) و`id=ayah-N` (238) ونص الآية (239)؛ تلحق حبة الرقم `.ayah-num` (240-243) ومسافة (244)؛ تربط `onclick`: تبديل + `refreshAyahUI` + تبديل صنف `read` محليًا (246-248) + نقل صنف `last` للآية الأخيرة الحالية (249-252) + فحص الاكتمال (253)؛ ترجع العنصر (255).
- **لماذا وُجدت:** تغليف كل آية كعنصر نقّار يحدّث نفسه دون إعادة رسم السورة.
- **التأثيرات:** إنشاء DOM + ربط حدث؛ عند النقر: `localStorage` (عبر `refreshAyahUI`) وتعديل أصناف.
- **تناديها:** `openSurah` (298). **تنادي:** `toggleAyahRead`، `refreshAyahUI`، `checkKhatmaComplete`.

### `openSurah(number, scrollToAyah = null)` — سطر 259

- **التوقيع:** `async function openSurah(number, scrollToAyah = null)`
- **ماذا تفعل وكيف:** تضبط `currentSurah` (260)؛ تجد `meta` وترجع إن غابت (261-262)؛ ترسم العنوان `#surahTitle` والوصف `#surahMeta` (263-264) و`جاري التحميل…` (265)؛ تبرز الفهرس (266)؛ تُخرج السورة من طابور الخلفي `dequeue` وتوقفه `userActive(true)` (268-269)؛ تفعّل زر الإتمام (270-271)؛ تجلب `loadSurahAyahs` (274) — عند الفشل: تستأنف الخلفي `userActive(false)` (276)، حارس السباق `currentSurah !== number` (277)، رسالة الخطأ الثابتة عن السور المحفوظة (278)؛ تستأنف الخلفي (281) وحارس السباق الثاني (282)؛ تفرّغ `#reader` وتبني `Fragment` (284-286)؛ بسملة زخرفية لكل السور عدا 1 و9 (287-291) + تجريد بسملة الآية 1 للعرض فقط (293-296)؛ تلحق الآيات عبر `createAyahElement` (298-299)؛ إن `scrollToAyah` تمرّر إليه بسلاسة بعد 100ms (301-305).
- **لماذا وُجدت:** الدالة المحورية لعرض سورة: عنوان + نص عثماني قابل للتعليم + تنسيق بسملة + تكامل مع التحميل الخلفي وحماية السباق.
- **المدخلات:** رقم السورة وآية اختيارية للتمرير (زر المتابعة).
- **التأثيرات:** قراءة DOM وكتابته (`#surahTitle`، `#surahMeta`، `#reader`)؛ قراءة `localStorage`/شبكة (عبر `loadSurahAyahs`)؛ إشارات لـ `window.SurahPreloader`.
- **تناديها:** نقرات الفهرس (194)؛ أزرار `data-goto` (1151)؛ المتابعة (1154-1155)؛ السابق/التالي (1180، 1183)؛ `completeCurrentSurah` (328)؛ `resetKhatma` (352)؛ `checkKhatmaComplete` (963)؛ `refreshAfterImport` (761). **تنادي:** `findSurah`، `highlightActiveSurah`، `loadSurahAyahs`، `stripBasmalaPrefix`، `createAyahElement`، `SurahPreloader.dequeue/userActive`.

### `completeCurrentSurah()` — سطر 310

- **التوقيع:** `async function completeCurrentSurah()`
- **ماذا تفعل وكيف:** ترجع إن لا سورة مفتوحة أو `meta` غائبة (311-313)؛ تقرأ الكاش لحساب `total` (احتياطي `meta.ayahs`) (314-315)؛ تحسب `unread = total - readCountOf` وترجع إن صفر (316-317)؛ تقرأ عدّاد اليوم (318)؛ تعرض `showModal` بعدد غير المقروء وأثره على الورد `اليوم: X ← X+unread` (319-323)؛ إن رفض ترجع (324)؛ تعلّم 1..total بحلقة `markAyahRead` (325) وتضبط `last` على آخر آية (326)؛ `refreshAyahUI` (327)؛ إن لم تكتمل الختمة تعيد `openSurah` (328 — عند الاكتمال يترك الرسم لـ `checkKhatmaComplete`).
- **لماذا وُجدت:** إتمام السورة دفعة واحدة بتأكيد يعرض الأثر — مع حماية (لا شيء دون سورة/دون جديد، زر `disabled` حتى تُفتح سورة في `index.html:157`).
- **التأثيرات:** `state` + حفظ + إحصاء + إعادة رسم القارئ؛ نافذة تأكيد.
- **تناديها:** زر `#completeSurahBtn` (1178). **تنادي:** `findSurah`، `getCachedAyahs`، `readCountOf`، `todayKey`، `showModal`، `markAyahRead`، `refreshAyahUI`، `checkKhatmaComplete`، `openSurah`.

### `resetKhatma()` — سطر 332

- **التوقيع:** `async function resetKhatma()`
- **ماذا تفعل وكيف:** تحسب `total` و`missing` (333-334)؛ تعرض `showModal` خطرًا أحمر (`danger:true`) بالنص الصريح `قرأت N — ينقصك M` + صندوق إقرار `أحتسبها… — أقر بأنني واعٍ` فقط عندما `0 < total < TOTAL_AYAS` (335-341)؛ تفكّ النتيجة `{ok, checked}` (342-343) وترجع إن رفض (344)؛ إن `checked` تزيد `khatmaCount` (345)؛ تصفّر `read` و`last` (346-347) وتحفظ (348)؛ تفرّغ البحث وتعيد رسم القائمة والإحصاء (349-351)؛ تعيد فتح الحالية إن وُجدت (352).
- **لماذا وُجدت:** تصفير الختمة لبدء جديدة — احتساب المكتملة يتطلب تعليمًا صريحًا غير معلَّم افتراضيًا، وإلا تصفير دون احتساب.
- **التأثيرات:** `localStorage` + `#search` + `#surahList` + الإحصاء + `#reader`.
- **تناديها:** زر `#resetBtn` (1157). **تنادي:** `readTotal`، `showModal`، `saveState`، `renderList`، `renderStats`، `openSurah`.

### قسم نقل التقدم — سطر 355

قسم مستقل بين `resetKhatma` و`=== الوضع الليلي` (355-888): ملف JSON محلي بلا شبكة. الثوابت: `PROGRESS_FORMAT = 2` (358) و`APP_VERSION` (360) و`PROGRESS_MAX_BYTES` (361) و`SOURCE_LABELS` (363)، والمتغيران `pendingImportMode` (364) و`undoTimer` (365).

| الدالة | السطر | ماذا تفعل |
|---|---|---|
| `isDayString` | 368 | تتحقق من `YYYY-MM-DD` حقيقي (ترفض 2026-02-31) |
| `isFutureDay` | 375 | ترفض ما بعد الغد (الغد نفسه مقبول حاليًا) |
| `daysAgoText` | 382 | صياغة «قبل يوم/يومين/N يومًا» |
| `renderTransferStatus` | 394 | تكتب سطر «آخر نسخة» من `state.lastExportAt` |
| `localStamp` | 403 | طابع محلي `YYYY-MM-DD HH:mm:ss` بساعة 24 |
| `timezoneInfo` | 408 | `{iana, offset}` مثل `Asia/Riyadh` و`+03:00` |
| `detectSource` | 420 | `localhost` / `apk` / `pwa` / `web` مع `origin` |
| `detectDevice` | 430 | وصف الجهاز من UA: `label/platform/model/browser/language` |
| `readToAyahs` | 473 | يحوّل خريطة `read` إلى قائمة `ayahs` مرتبة |
| `ayahsToRead` | 485 | يتحقق من `ayahs` v2 ويبني خريطة `read` — أو يرفض |
| `buildSummary` | 523 | ملخص وصفي: نسبة/متبقٍ/سلسلة أيام/ورد اليوم |
| `collectProgress` | 556 | يبني ملف v2 كاملًا (غلاف + وصف + `state` بلا `read`) |
| `exportProgress` | 582 | ينزّل `noor-progress-YYYY-MM-DD-HHmmss.json` ويحدّث `lastExportAt` |
| `parseProgressFile` | 601 | تحقق كامل (v2/v1، سقف، فهرس، تواريخ، إعدادات) قبل أي أثر |
| `describeImportMeta` | 704 | سطر «الملف من … — أُنشئ …» للمعاينة |
| `sanitizeLog` | 716 | تُبقي تواريخ وأعدادًا صالحة فقط |
| `mergeRead` | 728 | اتحاد الآيات بأقدم تاريخ (و`true` تُستبدل بتاريخ) |
| `mergeLog` | 740 | إعادة حساب الأيام من تواريخ `read` ثم `max` مع المحفوظ — بلا تضاعف |
| `refreshAfterImport` | 754 | إعادة رسم الهدف/الخط/الثيم/الفهرس/الإحصاء/القارئ |
| `showImportPreview` | 766 | معاينة عبر `showModal` (استبدال = danger) ثم `applyImport` |
| `applyImport` | 791 | نسخة أمان في `BACKUP_KEY` (816) ثم دمج/استبدال وزر تراجع 10 ثوانٍ |
| `undoImport` | 833 | تستعيد `backup.state` (845) وتحذف النسخة |
| `pickImportFile` | 855 | تفتح `#importFile` بالوضع المختار |
| `handleImportFile` | 864 | سقف الحجم، قراءة، `parseProgressFile`، ثم المعاينة |

**v2 مقابل v1:** ملف v2 يحمل `state.ayahs` (قائمة مرتبة) **لا `read`**؛ و`read` يبقى شكل `localStorage` فقط. الاستيراد يقبل v2 وv1 ويرفض `version > 2`.

#### `isDayString(value)` — سطر 368

- **التوقيع:** `function isDayString(value)`
- **ماذا تفعل وكيف:** ترفض غير النص أو ما لا يطابق `^\d{4}-\d{2}-\d{2}$` (369)؛ تفكّ السنة/الشهر/اليوم (370) وتبني `new Date(year, month-1, day)` (371)؛ تتحقق أن المكوّنات عادت كما هي (372) — لذلك تُرفض `2026-02-31`.
- **لماذا وُجدت:** التحقق من كل تاريخ في الملف (آية/سجل/مستقبلي) دون الاعتماد على `Date.parse` المتسامح.
- **المدخلات:** أي قيمة. **المخرجات:** `boolean`.
- **تناديها:** `ayahsToRead` (515)؛ `parseProgressFile` (646)؛ `sanitizeLog` (720).

#### `isFutureDay(value)` — سطر 375

- **التوقيع:** `function isFutureDay(value)`
- **ماذا تفعل وكيف:** تبني `tomorrow` من اليوم +1 (376-377) وتقارن نصيًا `value > dateKeyOf(tomorrow)` (378) — أي أن **الغد نفسه مقبول** (لأنه ليس أكبر من مفتاح الغد)، وما بعده مرفوض؛ اليوم والأمس وما قبلهما مقبولان. هذا سلوك الدالة الحالي كما هو.
- **لماذا وُجدت:** منع تواريخ مستقبلية في ملف مستورد (عبث أو ساعة جهاز خاطئة).
- **المدخلات:** نص `YYYY-MM-DD` صالح. **المخرجات:** `boolean`.
- **تناديها:** `ayahsToRead` (516)؛ `parseProgressFile` (647)؛ `sanitizeLog` (720). **تنادي:** `dateKeyOf`.

#### `daysAgoText(iso)` — سطر 382

- **التوقيع:** `function daysAgoText(iso)`
- **ماذا تفعل وكيف:** تحوّل ISO إلى `Date` (383) وترجع `''` إن غير صالح (384)؛ تحسب الأيام `floor((Date.now() - then) / 86400000)` (385)؛ صياغة عربية: `اليوم` (386)، `قبل يوم واحد` (387)، `قبل يومين` (388)، `قبل N أيام` حتى 10 (389)، ثم `قبل N يومًا` (390).
- **لماذا وُجدت:** سطر «آخر نسخة» الودّي بدل تاريخ خام.
- **المدخلات:** نص ISO. **المخرجات:** نص عربي أو `''`.
- **تناديها:** `renderTransferStatus` (398).

#### `renderTransferStatus()` — سطر 394

- **التوقيع:** `function renderTransferStatus()`
- **ماذا تفعل وكيف:** تجد `#lastExportLine` وترجع إن غاب (395-396)؛ إن `state.lastExportAt` تكتب `آخر نسخة: <daysAgoText>.` (397-398) وإلا رسالة «لم تصدّر نسخة بعد…» (399).
- **لماذا وُجدت:** تذكير دائم بأهمية النسخة الاحتياطية، ومنع تغييره بالاستيراد (المصدر `state.lastExportAt` فقط).
- **التأثيرات:** كتابة DOM فقط.
- **تناديها:** `exportProgress` (596)؛ `refreshAfterImport` (760)؛ `init` (1232).

#### `localStamp(date)` — سطر 403

- **التوقيع:** `function localStamp(date)`
- **ماذا تفعل وكيف:** ترجع `${dateKeyOf(date)} ${pad2(getHours())}:${pad2(getMinutes())}:${pad2(getSeconds())}` (404) — ساعة 24 من `getHours` (0-23) بلا AM/PM.
- **لماذا وُجدت:** `exportedAtLocal` مقروء للبشر في الغلاف، واسم الملف المبني عليه.
- **المدخلات:** `Date`. **المخرجات:** `YYYY-MM-DD HH:mm:ss` بالتوقيت المحلي.
- **تناديها:** `collectProgress` (564). **تنادي:** `dateKeyOf`، `pad2`.

#### `timezoneInfo()` — سطر 408

- **التوقيع:** `function timezoneInfo()`
- **ماذا تفعل وكيف:** تقرأ اسم المنطقة من `Intl.DateTimeFormat().resolvedOptions().timeZone` مع `UTC` احتياطيًا (409-412)؛ تحسب الدقائق `total = -getTimezoneOffset()` (413، موجب شرق غرينتش)؛ تحدد الإشارة `-` أو `+` (414)؛ ترجع `{iana, offset}` بصيغة `+03:00` / `-04:30` / `+00:00` (415-416).
- **لماذا وُجدت:** تحديد توقيت الجهاز الذي أُنشئ فيه الملف — وصفي فقط.
- **المدخلات:** لا شيء. **المخرجات:** `{iana: string, offset: string}`.
- **تناديها:** `collectProgress` (565). **تنادي:** `pad2`.

#### `detectSource()` — سطر 420

- **التوقيع:** `function detectSource()`
- **ماذا تفعل وكيف:** تقرأ `location.origin` و`hostname` (421-422)؛ بالترتيب: `localhost/127.0.0.1/::1/[::1]` → `localhost` (423)؛ referrer يبدأ `android-app://` أو `window.Capacitor?.isNativePlatform?.()` → `apk` (424)؛ `display-mode: standalone` أو `navigator.standalone === true` → `pwa` (425)؛ وإلا `web` (426). كل الحالات ترجع `{kind, origin}`.
- **لماذا وُجدت:** تمييز بيئة التشغيل (ويب/مثبت/APK/محلي) في الغلاف الوصفي — لا يقرأ ولا يغيّر الحالة.
- **المدخلات:** لا شيء. **المخرجات:** `{kind: 'localhost'|'apk'|'pwa'|'web', origin: string}`.
- **تناديها:** `collectProgress` (566).

#### `detectDevice()` — سطر 430

- **التوقيع:** `function detectDevice()`
- **ماذا تفعل وكيف:** تقرأ `navigator.userAgent` و`navigator.language` (431-432)؛ تحدد المنصة بالترتيب: أندرويد مع إصدار (436-438)، iPhone (439)، iPad (440)، Windows (441)، macOS (442)، Linux (443) — وإلا `Unknown`. تستخرج الطراز من نمط أندرويد القياسي «Android …; <MODEL> Build/» وتستبعد `wv` (446-450). تحدد المتصفح بالترتيب Edge → Opera → Chrome → Firefox → Safari لتفادي تداخل الـ UA (453-465). `label` = «الطراز • المنصة» إن وُجد طراز، وإلا «المنصة • المتصفح» (467). ترجع `{label, platform, model, browser, language}` (468).
- **لماذا وُجدت:** وصف مقروء للجهاز في معاينة الاستيراد — مشتق من UA فقط بلا مكتبات كشف، ولا يدخل الحالة.
- **المدخلات:** لا شيء. **المخرجات:** كائن الجهاز أعلاه.
- **تناديها:** `collectProgress` (567).

#### `readToAyahs(read)` — سطر 473

- **التوقيع:** `function readToAyahs(read)`
- **ماذا تفعل وكيف:** تأخذ مفاتيح الخريطة (474) وتفكّها إلى `surah/ayah` بأرقام (476)؛ القيمة النصية تصبح `{surah, ayah, date}` (478) والقيمة القديمة `true` تصبح `{surah, ayah, date: null, legacy: true}` (478)؛ تفلتر غير الصحيح (480)؛ ترتب بالسورة ثم الآية (481).
- **لماذا وُجدت:** تحويل `state.read` الداخلي (خريطة) إلى `state.ayahs` (قائمة مرتبة) في ملف v2 — المرجع في الملف، مع إبقاء `true` واضحة.
- **المدخلات:** خريطة `read`. **المخرجات:** `Array<{surah, ayah, date, legacy?}>` مرتبة.
- **تناديها:** `collectProgress` (570).

#### `ayahsToRead(ayahs)` — سطر 485

- **التوقيع:** `function ayahsToRead(ayahs)`
- **ماذا تفعل وكيف:** ترفض غير المصفوفة (486) وتجاوز 6236 (487-489)؛ لكل عنصر: كائن غير مصفوفة (493-495)، `surah/ayah` أعداد صحيحة حقيقية بأنواع `number` (497-499)، داخل الفهرس (`meta` و`1 ≤ ayah ≤ meta.ayahs`) (502-505)، لا تكرار للمفتاح (506-508)؛ `date` غائب أو `null` → `true` (510-512)، وإلا نص صالح لا يتجاوز الغد (514-517). أي خطأ يرجع `{ok:false, error}` بلا أثر على الحالة.
- **لماذا وُجدت:** التحقق الصارم لصيغة v2 قبل بناء `read` — ترفض الملف كاملًا عند أول خطأ.
- **المدخلات:** `state.ayahs` من الملف. **المخرجات:** `{ok:true, read}` أو `{ok:false, error}`.
- **تناديها:** `parseProgressFile` (621). **تنادي:** `findSurah`، `isDayString`، `isFutureDay`، `TOTAL_AYAS`.

#### `buildSummary()` — سطر 523

- **التوقيع:** `function buildSummary()`
- **ماذا تفعل وكيف:** تحسب `total` (524) و`today` (525) و`count` من `log` (526) و`goal` (527)؛ تجمع أيام `log` الموجبة وترتبها (528)؛ تحسب `streakDays` من اليوم إن كان فيه قراءة وإلا من الأمس ثم للخلف (531-537)؛ تعدّ `completedSurahs` حيث `readCountOf === meta.ayahs` (539)؛ ترجع `{readCount, totalAyahs, percent, remaining, khatmaCount, completedSurahs, activeDays, streakDays, firstReadDate, today:{date,count,goal,remaining,met}}` (540-551). `percent = Math.round((total/6236)*10000)/100` (543).
- **لماذا وُجدت:** ملخص وصفي لحظي يوضع في الملف ليسهل فهم النسخة بشرًا — **لا يُستورد إلى الحالة**.
- **المدخلات:** لا شيء (تقرأ `state` و`surahs`). **المخرجات:** كائن `summary`.
- **تناديها:** `collectProgress` (568).

#### `collectProgress()` — سطر 556

- **التوقيع:** `function collectProgress()`
- **ماذا تفعل وكيف:** تأخذ `now` (557)؛ تبني الغلاف صراحةً بلا spread: `app:'noor'`، `kind:'progress'`، `version:2`، `appVersion`، `exportedAt: now.toISOString()`، `exportedAtLocal: localStamp(now)`، `timezone`، `source`، `device`، `summary` (558-568)؛ ثم `state` بالحقول: `ayahs: readToAyahs(state.read)`، `last`، `khatmaCount`، `dailyGoal`، `fontSize`، `theme`، `log` (569-577) — **بلا `read`**.
- **لماذا وُجدت:** عزل بناء الملف عن شكل الحالة الداخلي، وعدم تسريب حقول غير موثوقة.
- **المدخلات:** لا شيء. **المخرجات:** كائن ملف v2 كامل.
- **تناديها:** `exportProgress` (583). **تنادي:** `localStamp`، `timezoneInfo`، `detectSource`، `detectDevice`، `buildSummary`، `readToAyahs`.

#### `exportProgress()` — سطر 582

- **التوقيع:** `function exportProgress()`
- **ماذا تفعل وكيف:** تبني `payload` (583)؛ تنشئ `Blob` من `JSON.stringify(payload, null, 2)` بنوع `application/json` (584)؛ تنشئ رابط تنزيل مؤقت (585-592)؛ اسم الملف `noor-progress-${exportedAtLocal.replace(' ', '-').replace(/:/g, '')}.json` أي `noor-progress-YYYY-MM-DD-HHmmss.json` (589)؛ تحرر الـ URL بعد ثانيتين (593)؛ تحدّث `state.lastExportAt = payload.exportedAt` وتحفظ وتعيد رسم سطر «آخر نسخة» (594-596)؛ تكتب رسالة البدء في `#transferStatus` (597).
- **لماذا وُجدت:** تصدير نسخة كاملة تعمل على الجوال وسطح المكتب بلا شبكة.
- **التأثيرات:** تنزيل ملف + كتابة `localStorage` + DOM.
- **تناديها:** زر `#exportBtn` (1160).

#### `parseProgressFile(text)` — سطر 601

- **التوقيع:** `function parseProgressFile(text)`
- **ماذا تفعل وكيف:** `JSON.parse` داخل try (603-607)؛ ترفض غير الكائن/المصفوفة (608-610)؛ تختار `src = root.state` إن كان كائنًا وإلا `root` (612)؛ ترفض `version > 2` (613-615)؛ تستخدم `src.ayahs` إن كانت مصفوفة وإلا `root.ayahs` إن كانت مصفوفة (618)؛ إن وُجدت تمررها إلى `ayahsToRead` (620-623)، وإلا تقبل `read` بصيغة v1: كائن غير مصفوفة (626-628)، ≤6236 (629-632)، مفتاح `^\d{1,3}:\d{1,3}$` (635-636)، داخل الفهرس (637-641)، `true` مقبولة (642-644)، وتاريخ صالح لا يتجاوز الغد (646-648). ثم `last` يُتحقق ويعاد بناؤه باسم السورة (652-660)؛ تقيّد `dailyGoal` 1-500 و`fontSize` 1.2-3 و`theme` و`khatmaCount` و`log` (662-696)؛ تحلل `exportedAt` (665، 697). تبني `meta` للعرض فقط بنصوص مقصوصة ونوع مصدر مسموح: `version/appVersion/exportedAt/exportedAtLocal/source/device` (667-685).
- **لماذا وُجدت:** التحقق الكامل قبل أي لمس للحالة — الملف يُرفض كاملًا عند أول خطأ، والوصفي لا يدخل `incoming`.
- **المدخلات:** نص الملف. **المخرجات:** `{ok:true, incoming, meta}` أو `{ok:false, error}`.
- **تناديها:** `handleImportFile` (882). **تنادي:** `ayahsToRead`، `findSurah`، `isDayString`، `isFutureDay`، `sanitizeLog`، `SOURCE_LABELS`، `PROGRESS_FORMAT`، `TOTAL_AYAS`.

#### `describeImportMeta(meta)` — سطر 704

- **التوقيع:** `function describeImportMeta(meta)`
- **ماذا تفعل وكيف:** ترجع `''` إن لا `meta` (705)؛ تترجم `source.kind` عبر `SOURCE_LABELS` (706)؛ تأخذ `device.label` (707)؛ تبني `from` = «الجهاز (النوع)» أو النوع فقط (708)؛ تجمع «الملف من: …» و«أُنشئ: …» بفاصل `—` وتحذف الغائب (709-711)؛ ترجع السطر منتهيًا بنقطة ومسافة أو `''` (712).
- **لماذا وُجدت:** سطر وصفي أول معاينة الاستيراد يخبر المستخدم مصدر الملف وتاريخه قبل التأكيد — لا يدخل الحالة.
- **المدخلات:** `meta` من `parseProgressFile`. **المخرجات:** نص عربي أو `''`.
- **تناديها:** `showImportPreview` (774). **تنادي:** `SOURCE_LABELS`.

#### `sanitizeLog(raw)` — سطر 716

- **التوقيع:** `function sanitizeLog(raw)`
- **ماذا تفعل وكيف:** ترجع `{}` إن لم يكن كائنًا غير مصفوفة (717-718)؛ تمر على كل يوم: تقبل تاريخًا صالحًا لا يتجاوز الغد فقط (720) وعددًا صحيحًا `0..6236` (721-722)؛ تجمع النظيف (723).
- **لماذا وُجدت:** سجل الأيام في الملف قد يكون معطوبًا — نُبقي الصالح فقط ثم يعاد الحساب في `mergeLog`.
- **المدخلات:** `log` من الملف. **المخرجات:** كائن سجل نظيف.
- **تناديها:** `parseProgressFile` (696). **تنادي:** `isDayString`، `isFutureDay`، `TOTAL_AYAS`.

#### `mergeRead(localRead, incomingRead)` — سطر 728

- **التوقيع:** `function mergeRead(localRead, incomingRead)`
- **ماذا تفعل وكيف:** تبدأ بنسخة من المحلي (729)؛ لكل مفتاح وارد: إن غاب يُضاف (732)؛ إن كانت القيمة الحالية غير نصية والواردة نصية تُستبدل (733 — `true` القديمة تُستبدل بأي تاريخ)؛ إن كانتا نصيتين والواردة أقدم تُستبدل (734).
- **لماذا وُجدت:** اتحاد آمن للآيات يحفظ أقدم تاريخ تعليم (لا يضاعف العدّ ولا يقدّم التاريخ).
- **المدخلات:** خريطتا `read`. **المخرجات:** خريطة مدموجة.
- **تناديها:** `applyImport` (794).

#### `mergeLog(localLog, importedLog, read)` — سطر 740

- **التوقيع:** `function mergeLog(localLog, importedLog, read)`
- **ماذا تفعل وكيف:** تعيد حساب الأيام من قيم `read` النصية فقط (741-744)؛ تجمع مفاتيح المحلي والمستورد والمحسوب (745)؛ لكل يوم تأخذ `Math.max` للثلاثة (747-749) — فلا ينقص سجل سابق ولا يتضاعف.
- **لماذا وُجدت:** توحيد سجل الأيام بعد الدمج/الاستبدال من مصدر الحقيقة (`read`) مع الحفاظ على تاريخ الختمات الماضية.
- **المدخلات:** `localLog`، `importedLog`، خريطة `read` النهائية. **المخرجات:** سجل مدموج.
- **تناديها:** `applyImport` (799، 810).

#### `refreshAfterImport()` — سطر 754

- **التوقيع:** `function refreshAfterImport()`
- **ماذا تفعل وكيف:** تنادي بالترتيب: `applyGoalUI`، `applyReaderFontSize`، `applyTheme`، `renderList`، `renderStats`، `renderTransferStatus`، ثم `openSurah(currentSurah)` إن كانت هناك سورة مفتوحة (755-761).
- **لماذا وُجدت:** كل ما يعتمد على الحالة يجب أن يعاد رسمه بعد الاستيراد/التراجع — لا يكفي حفظ الحالة.
- **التأثيرات:** DOM + إعادة رسم القارئ.
- **تناديها:** `applyImport` (820)؛ `undoImport` (850).

#### `showImportPreview(incoming, mode, meta = null)` — سطر 766

- **التوقيع:** `async function showImportPreview(incoming, mode, meta = null)`
- **ماذا تفعل وكيف:** تحسب `total` ونسبته `toFixed(2)` و`localTotal` و`added` (767-770)؛ تبني `lastLine` حسب وجود `last` (771-773) و`metaLine` من `describeImportMeta` (774)؛ نص الاستبدال يذكر الحجم الحالي والإعدادات وموضع التوقف، ونص الدمج يذكر عدد الآيات المضافة (775-779)؛ تعرض `showModal` بعنوان مناسب و`danger` في الاستبدال (780-785)؛ إن تأكد تنادي `applyImport` (786-787).
- **لماذا وُجدت:** معاينة الأثر قبل التطبيق — الاستبدال خطر لا يُلغى بالنقر خارج البطاقة.
- **المدخلات:** `incoming` و`mode` و`meta`. **المخرجات:** لا شيء؛ نافذة ثم تطبيق.
- **تناديها:** `handleImportFile` (887). **تنادي:** `readTotal`، `describeImportMeta`، `showModal`، `applyImport`.

#### `applyImport(incoming, mode)` — سطر 791

- **التوقيع:** `function applyImport(incoming, mode)`
- **ماذا تفعل وكيف:** تنسخ الحالة السابقة عميقًا (792)؛ `replace = mode === 'replace'` (793)؛ تحسب `mergedRead` (794)؛ تبني `next`: في الاستبدال `read` من الملف و`log = mergeLog({}, incoming.log, incoming.read)` و`khatmaCount/last/dailyGoal/fontSize/theme` من الملف و`lastExportAt = incoming.exportedAt` (796-806)؛ في الدمج `read = mergedRead` و`log = mergeLog(state.log, incoming.log, mergedRead)` و`khatmaCount = max` و`last = state.last || incoming.last` مع بقاء الإعدادات المحلية (808-812)؛ تحسب `added` (814)؛ تكتب نسخة أمان `{savedAt, state: before}` في `BACKUP_KEY` داخل try (815-817)؛ تستبدل `state` وتحفظ وتعيد الرسم (818-820)؛ تكتب رسالة النتيجة (821-823)؛ تظهر زر التراجع وتضبط مؤقت إخفائه 10 ثوانٍ (824-829).
- **لماذا وُجدت:** نقطة التطبيق الوحيدة — نسخة أمان دائمًا + تراجع مؤقت، وبلا `checkKhatmaComplete` (الاستيراد ليس قراءة جديدة).
- **التأثيرات:** `state` + `localStorage` (الحالة + النسخة) + DOM.
- **تناديها:** `showImportPreview` (787). **تنادي:** `mergeRead`، `mergeLog`، `saveState`، `refreshAfterImport`، `BACKUP_KEY`.

#### `undoImport()` — سطر 833

- **التوقيع:** `function undoImport()`
- **ماذا تفعل وكيف:** تقرأ `BACKUP_KEY` بـ `JSON.parse` داخل try (834-839)؛ إن لا `saved.state` تكتب رسالة وتخفي الزر (840-844)؛ وإلا تستعيد `{...defaultState(), ...saved.state}` (845) وتحفظ (846) وتحذف النسخة (847) وتلغي المؤقت وتخفي الزر (848-849) وتعيد الرسم وتكتب رسالة التراجع (850-851).
- **لماذا وُجدت:** تراجع فوري بعد استيراد خاطئ — النسخة تبقى في `localStorage` حتى استيراد تالٍ أو تراجع.
- **التأثيرات:** `state` + `localStorage` (حذف النسخة) + DOM.
- **تناديها:** زر `#undoImportBtn` (1164). **تنادي:** `defaultState`، `saveState`، `refreshAfterImport`.

#### `pickImportFile(mode)` — سطر 855

- **التوقيع:** `function pickImportFile(mode)`
- **ماذا تفعل وكيف:** تحفظ الوضع في `pendingImportMode` (856)؛ تجد `#importFile` وترجع إن غاب (857-858)؛ تصفّر `input.value` (859) وتفتح المنتقي `input.click()` (860).
- **لماذا وُجدت:** زرّا الاستيراد يمرران الوضع ثم منتقي الملف واحد يقرأه `handleImportFile`.
- **تناديها:** زرّا `#importMergeBtn` (1161) و`#importReplaceBtn` (1162).

#### `handleImportFile(file)` — سطر 864

- **التوقيع:** `async function handleImportFile(file)`
- **ماذا تفعل وكيف:** ترجع إن لا ملف (865)؛ ترفض ما يتجاوز `PROGRESS_MAX_BYTES` بنافذة «الملف كبير جدًا» (866-874)؛ تقرأ `file.text()` داخل try (876-881)؛ تمرر النص إلى `parseProgressFile` وتعرض الخطأ في نافذة واحدة عند الفشل (882-886)؛ عند النجاح تعرض `showImportPreview(parsed.incoming, pendingImportMode, parsed.meta)` (887).
- **لماذا وُجدت:** البوابة الوحيدة لقراءة الملف — الحجم والقراءة والتحقق والمعاينة، بلا أثر عند أي فشل.
- **المدخلات:** `File`. **المخرجات:** لا شيء؛ نافذة أو معاينة.
- **تناديها:** حدث `change` على `#importFile` (1163). **تنادي:** `showModal`، `parseProgressFile`، `showImportPreview`، `PROGRESS_MAX_BYTES`.

### `currentTheme()` — سطر 892

- **التوقيع:** `function currentTheme()`
- **ماذا تفعل وكيف:** إن `state.theme` محفوظ `dark/light` ترجعه (893)؛ وإلا تقرأ `matchMedia('(prefers-color-scheme: dark)')` وترجع `dark` أو `light` (894).
- **لماذا وُجدت:** الثيم الفعلي: صريح محفوظ أو تلقائي حسب النظام عندما `theme === null`.
- **تناديها:** `applyTheme` (899)؛ `toggleTheme` (910).

### `applyTheme()` — سطر 898

- **التوقيع:** `function applyTheme()`
- **ماذا تفعل وكيف:** تحسب `dark` (899)؛ تضبط/تزيل `documentElement.dataset.theme` (900-901)؛ تحدّث زر `#themeToggle` (أيقونة `☀/☾` و`aria-pressed`) (902-905).
- **لماذا وُجدت:** تطبيق الثيم عبر `data-theme` على `html` (يكمله سكربت منع الوميض في `index.html:10`).
- **التأثيرات:** سمة DOM + نص الزر وحالته لقارئ الشاشة.
- **تناديها:** `toggleTheme` (912)؛ مستمع تغيّر النظام (1176)؛ `refreshAfterImport` (757)؛ `init` (1226 قبل الرسم). **تنادي:** `currentTheme`.

### `toggleTheme()` — سطر 909

- **التوقيع:** `function toggleTheme()`
- **ماذا تفعل وكيف:** تعكس الثيم الفعلي وتحفظه صراحة (يلغي التلقائي) (910) ثم تحفظ وتطبّق (911-912).
- **التأثيرات:** `state.theme` + حفظ + DOM.
- **تناديها:** زر `#themeToggle` (1173). **تنادي:** `currentTheme`، `saveState`، `applyTheme`.

### `changeFontSize(step)` — سطر 916

- **التوقيع:** `function changeFontSize(step)`
- **ماذا تفعل وكيف:** تجمع `step` على الحالية (احتياطي 1.9) وتقيّد `[1.2, 3]` (917) ثم تحفظ وتطبّق (918-919).
- **لماذا وُجدت:** تكبير/تصغير خط القارئ بحدّين ثابتين (rem).
- **التأثيرات:** `state.fontSize` + حفظ + متغير CSS.
- **تناديها:** زرّا `#fontPlus/#fontMinus` (1171-1172). **تنادي:** `saveState`، `applyReaderFontSize`.

### `applyReaderFontSize()` — سطر 923

- **التوقيع:** `function applyReaderFontSize()`
- **ماذا تفعل وكيف:** `#reader.style.setProperty('--reader-size', fontSize + 'rem')` (924).
- **لماذا وُجدت:** الضبط عبر متغير CSS حصرًا — `style.fontSize` المباشر ممنوع لأنه يقتل `clamp()` المتجاوب (`css/style.css:207` و`:267`).
- **التأثيرات:** خاصية CSS على `#reader` فقط.
- **تناديها:** `changeFontSize` (919)؛ `refreshAfterImport` (756)؛ `init` (1229).

### `renderStats()` — سطر 928

- **التوقيع:** `function renderStats()`
- **ماذا تفعل وكيف:** `total = readTotal()` (929) و`percent = total/TOTAL_AYAS*100` (930)؛ تكتب `#percent` بصيغتين عشريتين (931) و`#statsLine` (مقروء/كلي • متبقٍ) (932) وعرض `#progressFill` (933) و`aria-valuenow/max` على `#khatmaProgress` (934-935) و`#todayCount` (اليوم: log ← goal) (936) و`#khatmaCount` (937)؛ فرع `last`: زر المتابعة `تابع: name آية N` و`آخر قراءة: سورة…` (938-940) أو الافتراضي `تابع القراءة / لم تبدأ…` (941-944)؛ ثم شريط المتابعة اللاصق: `#stripToday` و`#stripPercent` و`--p` على `#trackStrip` (945-951).
- **لماذا وُجدت:** لوحة الختمة الوحيدة — نسبة وشريط وورد اليوم وآخر قراءة وعدد الختمات، مع `aria-live` وإمكانية وصول، وشريط الجوال اللاصق.
- **التأثيرات:** كتابة عناصر DOM (`#percent`، `#statsLine`، `#progressFill`، `#khatmaProgress` سمتان، `#todayCount`، `#khatmaCount`، `#continueBtn`، `#lastReadLine`، `#trackStrip` و`#stripToday`/`#stripPercent`)؛ لا تخزين.
- **تناديها:** `refreshAyahUI` (140)؛ `resetKhatma` (351)؛ `checkKhatmaComplete` (961)؛ `bindEvents/setGoal` (1139)؛ `refreshAfterImport` (759)؛ `init` (1228). **تنادي:** `readTotal`، `todayKey`.

### `checkKhatmaComplete()` — سطر 955

- **التوقيع:** `async function checkKhatmaComplete()`
- **ماذا تفعل وكيف:** إن `readTotal() < 6236` ترجع `false` دون أثر (956)؛ وإلا: تزيد العداد (957) وتصفّر `read` و`last` (958-959) وتحفظ (960) وتعيد رسم الإحصاء والقائمة والقارئ (961-963)؛ تعرض نافذة تهنئة بزر واحد `single:true` بعدد الختمات (964-969)؛ ترجع `true` (970).
- **لماذا وُجدت:** الاحتفال التلقائي الوحيد عند بلوغ 6236 — يصفّر أولًا ثم يهنئ ويبدأ ختمة جديدة تلقائيًا.
- **التأثيرات:** `state` + حفظ + 3 رسومات + نافذة.
- **تناديها:** نقرة الآية (253)؛ `completeCurrentSurah` (328). **تنادي:** `readTotal`، `saveState`، `renderStats`، `renderList`، `openSurah`، `showModal`.

### `showModal({title, body, confirmText, danger, single, checkboxLabel})` — سطر 977

- **التوقيع:** `function showModal({...})` ترجع `Promise<boolean | {ok, checked}>`
- **ماذا تفعل وكيف:** تحفظ التركيز السابق (979)؛ تبني `overlay > card[role=alertdialog][aria-modal]` + عنوان `h2#modalTitle` ووصف `p#modalDesc` مربوطين بـ `aria-labelledby/describedby` (980-994)؛ صندوق إقرار اختياري `label.modal-check > checkbox + span` غير معلَّم (995-1006)؛ زر تأكيد `btn-danger/btn-primary` (1009-1013) وزر `تراجع btn-quiet` إلا في `single` (1014-1021)؛ تلحق بالـ `body` وتمنع التمرير (1023-1025)؛ `close(value)` تزيل وتمسح المنع وتعيد التركيز وتحلّ الوعد (بـ `{ok, checked}` عند وجود صندوق) (1027-1032)؛ تعطيل زر التأكيد حتى تعليم الصندوق (1034-1037)؛ ربط التأكيد/التراجع (1038-1039)؛ النقر خارج البطاقة يلغي إلا في `danger` (1040)؛ `Esc` يلغي وحبس `Tab` داخل البطاقة (1041-1049)؛ التركيز الأولي على التراجع في الخطر وإلا التأكيد (1050).
- **لماذا وُجدت:** نظام النوافذ الوحيد بدل `alert/confirm` الأصليين (ممنوعان) — تأكيد خطر أو إشعار بزر واحد، مع حبس تركيز و`Esc` وإعادة تركيز.
- **المدخلات/المخرجات:** خيارات مفككة أعلاه؛ تحلّ بـ `boolean` عادة أو `{ok, checked}` مع صندوق.
- **التأثيرات:** DOM مؤقت + `body.overflow` + إدارة التركيز.
- **تناديها:** `completeCurrentSurah` (319)؛ `resetKhatma` (335)؛ `checkKhatmaComplete` (964)؛ `showImportPreview` (780)؛ `handleImportFile` (867، 879، 884).

### `cachedSurahCount()` — سطر 1058

- **التوقيع:** `function cachedSurahCount()`
- **ماذا تفعل وكيف:** حلقة 1..114 تعدّ مفاتيح `CACHE_PREFIX+i` الموجودة (1059-1065)؛ أي استثناء يوقف العدّ (1063).
- **لماذا وُجدت:** عدد السور المحفوظة بفحص متزامن سريع — يغذي الزر والشريط.
- **تناديها:** `updateCacheBar` (1069).

### `updateCacheBar()` — سطر 1068

- **التوقيع:** `function updateCacheBar()`
- **ماذا تفعل وكيف:** تحسب `n` (1069)؛ تحدّث `#cacheBarBtn` (`السور المحفوظة: N / 114`) (1070-1071)؛ إن غاب `#cacheBar` ترجع (1072-1073)؛ وإلا تحدّث `.cache-text` وعرض `.cache-fill` بنسبة `n/114` (1074-1075).
- **لماذا وُجدت:** إبقاء نص الزر وشريط الحالة حيّين بعد كل حفظ وكل تقدّم خلفي.
- **التأثيرات:** كتابة DOM فقط.
- **تناديها:** `saveSurahCache` (90)؛ `showCacheBar` (1106)؛ حدث `surah-cache-progress` (1170)؛ `init` (1231 — الزر فقط). **تنادي:** `cachedSurahCount`.

### `hideCacheBar()` — سطر 1078

- **التوقيع:** `function hideCacheBar()`
- **ماذا تفعل وكيف:** تمسح المؤقت وتصفّره (1079-1080) وتزيل `#cacheBar` بـ `?.` (1081).
- **لماذا وُجدت:** إخفاء الشريط (يدوي بزر ✕ أو تلقائي بعد 5 ثوانٍ أو قبل إنشاء جديد).
- **تناديها:** زر ✕ (1103)؛ مؤقت الـ 5 ثوانٍ (1107)؛ بداية `showCacheBar` (1085).

### `showCacheBar()` — سطر 1084

- **التوقيع:** `function showCacheBar()`
- **ماذا تفعل وكيف:** تزيل القديم أولًا (1085)؛ تبني `#cacheBar.cache-bar[role=status]` من نص + مسار تعبئة + زر إغلاق `✕` (1086-1104)؛ تلحق بالـ `body` (1105)؛ تحدّث الأرقام (1106)؛ تضبط مؤقت الإخفاء 5000ms (1107).
- **لماذا وُجدت:** شريط حالة يدوي فقط بزر الـ footer — لا ظهور تلقائي في `init` (تعليق سطر 1054).
- **التأثيرات:** إنشاء DOM + مؤقت.
- **تناديها:** زر `#cacheBarBtn` (1158). **تنادي:** `hideCacheBar`، `updateCacheBar`.

### `updateNetStatus()` — سطر 1111

- **التوقيع:** `function updateNetStatus()`
- **ماذا تفعل وكيف:** تجد `#netStatus` وترجع إن غابت (1112-1113)؛ إن متصل: `hidden=true` وتزيل `offline` (1114-1116)؛ وإلا: تظهرها بنص `أنت تعمل الآن دون اتصال…` وتضيف `offline` (1117-1121).
- **لماذا وُجدت:** شارة الاتصال — مخفية عند الاتصال، ظاهرة فقط دون إنترنت (`index.html:46`).
- **تناديها:** `bindEvents` (1166) وحدثا `online/offline` (1167-1168).

### `applyGoalUI()` — سطر 1125

- **التوقيع:** `function applyGoalUI()`
- **ماذا تفعل وكيف:** تجد `#dailyGoal` وترجع إن غاب (1126-1127)؛ تكتب `state.dailyGoal` نصًا (1128) وتضبط `aria-valuenow` (1129).
- **لماذا وُجدت:** مزامنة عدّاد الهدف الظاهر مع الحالة بعد الاستيراد أيضًا، لا في `bindEvents` فقط.
- **تناديها:** `bindEvents` (1134)؛ `refreshAfterImport` (755).

### `bindEvents()` — سطر 1133

- **التوقيع:** `function bindEvents()`
- **ماذا تفعل وكيف:** تهيئ `#dailyGoal` عبر `applyGoalUI` (1134)؛ تعرّف `setGoal(v)` مقيّدة `[1,500]` مع كتابة وحفظ وإحصاء (1135-1140)؛ تربط: `goalUp/Down` (1141-1142)، أسهم `dailyGoal` (↑/→ +1، ↓/← −1، Home→1، End→500) (1143-1148)، بحث `debounced 200ms → renderList` (1149)، أزرار `data-goto` (1150-1152)، متابعة (آخر سورة+آية أو 1) (1153-1156)، `resetBtn → resetKhatma` (1157)، `cacheBarBtn → showCacheBar` (1158)، نقل التقدم: تصدير (1160)، استيراد/دمج (1161)، استبدال (1162)، `change` على `#importFile` (1163)، تراجع (1164)، `online/offline → updateNetStatus` (1166-1168)، `surah-cache-progress → updateCacheBar` (1170)، خط (1171-1172)، ثيم (1173) + تتبع النظام في الوضع التلقائي فقط (1175-1177)، إتمام السورة (1178)، سابق/تالي بحراسة الحدود (1179-1184)، طي الفهرس `collapsed` مع نص عرض/طي و`aria-expanded` (1185-1191).
- **لماذا وُجدت:** ربط كل أزرار الواجهة مرة واحدة من `init` (تعليق سطر 1132).
- **التأثيرات:** مستمعو أحداث + تهيئة `#dailyGoal`.
- **تناديها:** `init` (1225) فقط. **تنادي (غير مباشر):** كل ما سبق عبر الأحداث.

### `renderDaily()` — سطر 1195

- **التوقيع:** `async function renderDaily()`
- **ماذا تفعل وكيف:** تجلب `data/daily.json` (1197) وترمي إن `!ok` (1198)؛ تقبل مصفوفة مباشرة أو `{daily}` (1200) — والملف الحالي كائن `{daily: [{text, ref} × 30]}` — وترمي إن فارغة (1201)؛ تحسب يوم السنة `floor((now - Jan0)/86400000)` (1202-1203)؛ تختار `list[day % len]` اختيارًا حتميًا (1204) وترمي إن بلا نص (1205)؛ تكتب `#dailyText` و`#dailyRef` (`سورة ref`) (1206-1207)؛ عند أي فشل تكتب `تعذر تحميل آية اليوم.` (1209-1210).
- **أين تُعرض:** بطاقة `section.daily` فوق القارئ (`index.html:89-92`): شارة ثابتة `span.daily-badge` (سطر 90) + سطر النص `p.daily-text` (سطر 91) الذي يضم `#dailyText` ويليه مرجعه ملاصقًا `#dailyRef.daily-ref` (داخل نفس العنصر لا عنصر `flex` منفصل عند الحافة، `dir="auto"` للنص المختلط). الأنماط في `css/style.css` (صف `align-items:center` بحشوة `--pad-inline` وفجوة `--gap-md` حسب نظام الشرائط).
- **لماذا وُجدت:** آية اليوم — اختيار حتمي حسب يوم السنة (`dayOfYear % الطول`) يعمل دون إنترنت بعد أول تحميل.
- **التأثيرات:** كتابة `#dailyText` و`#dailyRef` فقط.
- **تناديها:** `init` (1230 دون انتظار).

### `init()` — سطر 1216

- **التوقيع:** `async function init()`
- **ماذا تفعل وكيف:** تجلب `data/surahs.json` (1218) وترمي إن `!ok` (1219) وتحفظ في `surahs` (1220)؛ عند الفشل تكتب `تعذر تحميل فهرس السور.` في `#surahList` وترجع (1221-1224)؛ ثم بالترتيب: `bindEvents` (1225)، `applyTheme` قبل الرسم لمنع الوميض (1226)، `renderList` (1227)، `renderStats` (1228)، `applyReaderFontSize` (1229)، `renderDaily` دون انتظار (1230)، `updateCacheBar` للزر فقط (1231)، `renderTransferStatus` لسطر «آخر نسخة» (1232)؛ تطلب `navigator.storage.persisted()` ثم `persist()` إن لم يكن دائمًا (1234-1238)؛ تضبط `history.scrollRestoration = 'manual'` وتصعد للأعلى (1239)؛ تبدأ التحميل الخلفي `SurahPreloader.start(last.surah || 1)` بعد `load` بثانيتين (1240-1244)؛ تكتب سنة الحقوق في `#year` (1246-1247)؛ لا فتح تلقائي لسورة (1248).
- **لماذا وُجدت:** نقطة الدخول — تحميل الفهرس ثم رسم كل شيء. تحتاج خادمًا محليًا لأن `fetch` يُحجب عبر `file://` (تعليق سطر 1215).
- **التأثيرات:** كل رسومات الإقلاع + بدء التحميل الخلفي.
- **تناديها:** الاستدعاء المباشر سطر 1251. **تنادي:** كل رسومات الإقلاع + `SurahPreloader.start`.

## 5. مفاتيح `localStorage` وشكلها

### `quran_tracker_v1` (سطر 10، يُقرأ 57-64، يُكتب 67-69)

```js
{
  read: { "18:5": "2026-10-14", /* … — قيم true القديمة مقبولة كـ truthy */ },
  last: { surah: 18, ayah: 5, name: "الكهف" }, // أو null
  khatmaCount: 0,
  dailyGoal: 20,   // يُقيَّد 1-500 في setGoal (سطر 1136) وعند الاستيراد (سطر 693)
  fontSize: 1.9,   // rem — يُقيَّد 1.2-3 في changeFontSize (سطر 917) وعند الاستيراد (سطر 694)
  log: { "2026-10-14": 7 }, // بتوقيت المتصفح المحلي (todayKey سطر 36)
  theme: null,     // null تلقائي | 'dark' | 'light'
  lastExportAt: null // ISO لآخر تصدير من هذا الجهاز أو null
}
```

- **الشكل لم يتغير في v2:** ملف التقدم يستخدم `state.ayahs`، أما `localStorage` فيبقى بخريطة `read` (`"سورة:آية" → تاريخ | true`).
- الافتراضيات في `defaultState` (سطر 54)؛ الدمج `{...defaultState(), ...saved}` (60) يحمي البيانات القديمة.
- `read`: المفتاح `"سورة:آية"` والقيمة تاريخ التعليم (نص) — العدّ `Object.keys().length` (95). التراجع ينقص `log[day]` فقط عندما القيمة نصًا (129).
- `last`: تُصفَّر عند التراجع عن نفس الآية (131) وعند التصفير/الاكتمال (347، 959).
- `lastExportAt`: يُحدَّث بعد كل تصدير (سطر 594)، ويأخذه الاستبدال من `exportedAt` الملف (سطر 805)، ولا يتغير بالدمج (فرع الدمج لا يمسه).
- الحقول الوصفية (`appVersion`، `exportedAtLocal`، `timezone`، `source`، `device`، `summary`) توجد في **الملف فقط** ولا تُحفظ هنا.

### `quran_tracker_backup_v1` (سطر 12)

```js
{ savedAt: "2026-10-19T09:12:00.000Z", state: { … نفس شكل quran_tracker_v1 … } }
```

- يُكتب في `applyImport` (سطر 816) قبل أي تعديل، يقرأه `undoImport` (836)، ويُحذف بعد التراجع (847). يبقى بعد انتهاء مهلة زر التراجع (10 ثوانٍ، سطر 827-829) حتى استيراد تالٍ.

### `surah_cache_<number>` (بادئة سطر 13)

```js
{ ayahs: [{ number: 1, text: "…" }, …] }
```

- يُقرأ في `getCachedAyahs` (80-81)، يُكتب في `saveSurahCache` (89)، يُعدّ في `cachedSurahCount` (1058).

## 6. خريطة النداءات الرئيسية

```text
init (1216)
├─ fetch data/surahs.json → surahs (1218-1220)
├─ bindEvents (1225)
│   ├─ applyGoalUI → #dailyGoal (1134)
│   ├─ search(input, debounce 200ms) → renderList → surahMatches → normalizeArabic/normalizeDigits (1149)
│   ├─ [data-goto] → openSurah (1150-1152)
│   ├─ continueBtn → openSurah(last.surah, last.ayah) أو openSurah(1) (1153-1156)
│   ├─ resetBtn → resetKhatma → showModal → saveState/renderList/renderStats/openSurah (1157)
│   ├─ cacheBarBtn → showCacheBar → updateCacheBar → cachedSurahCount (1158)
│   ├─ exportBtn → exportProgress → collectProgress → Blob/download (1160)
│   ├─ importMerge/ReplaceBtn → pickImportFile → #importFile (1161-1162)
│   ├─ importFile change → handleImportFile → parseProgressFile → showImportPreview → applyImport (1163)
│   ├─ undoImportBtn → undoImport → quran_tracker_backup_v1 (1164)
│   ├─ online/offline → updateNetStatus (1166-1168)
│   ├─ surah-cache-progress → updateCacheBar (1170)
│   ├─ fontPlus/Minus → changeFontSize → applyReaderFontSize (1171-1172)
│   ├─ themeToggle → toggleTheme → currentTheme/applyTheme (1173)
│   ├─ completeSurahBtn → completeCurrentSurah → showModal → markAyahRead… → refreshAyahUI → checkKhatmaComplete → openSurah (1178)
│   └─ prevSurah/nextSurah → openSurah(N±1) (1179-1184)
├─ applyTheme → currentTheme (1226)
├─ renderList → surahMatches/readCountOf/surahStatusText (1227)
├─ renderStats → readTotal/todayKey + #trackStrip (1228)
├─ applyReaderFontSize (1229)
├─ renderDaily — fetch data/daily.json → #dailyText/#dailyRef (1230)
├─ updateCacheBar — نص الزر فقط (1231)
├─ renderTransferStatus — سطر «آخر نسخة» (1232)
├─ navigator.storage.persisted → persist (1234-1238)
└─ SurahPreloader.start(last.surah || 1) (1240-1244)

openSurah (259)
├─ loadSurahAyahs → getCachedAyahs / OFFLINE_SURAHS+saveSurahCache / fetch API+saveSurahCache (274)
├─ highlightActiveSurah (266)
├─ stripBasmalaPrefix للآية 1 (عدا 1 و9) (294)
└─ createAyahElement لكل آية (298)
    └─ onclick: toggleAyahRead (246) → refreshAyahUI (→ saveState/renderStats/updateSurahBadge) → نقل صنف last → checkKhatmaComplete
        └─ عند 6236: تصفير + renderStats/renderList/openSurah + showModal تهنئة (955-971)

exportProgress (582)
└─ collectProgress (556) → localStamp/timezoneInfo/detectSource/detectDevice/buildSummary/readToAyahs
   └─ Blob → noor-progress-YYYY-MM-DD-HHmmss.json → lastExportAt (589-595)

import: #importFile change (1163)
└─ handleImportFile (864) — سقف 5MB
   └─ parseProgressFile (601) → ayahsToRead (485) أو read v1 → sanitizeLog
      └─ meta وصفي → showImportPreview (766) → describeImportMeta (704)
         └─ applyImport (791) → mergeRead/mergeLog → BACKUP_KEY → refreshAfterImport (754)
            └─ undoImport (833) — 10 ثوانٍ والنسخة تبقى
```
