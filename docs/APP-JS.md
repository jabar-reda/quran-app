# توثيق `js/app.js` — نور: مصحف الختمة

> شرح شفرة `app.js` فقط (1031 سطرًا). كل رقم سطر يشير إلى الملف الحالي. لا يصف المشروع عامة — راجع `README.md` لذلك.

## 1. نظرة سريعة

- `js/app.js` هو كل منطق التطبيق (Vanilla JS بلا اعتماديات): يحمّل فهرس 114 سورة من `data/surahs.json` ويرسمه في `#surahList` (`init` سطر 649).
- هيكل `index.html` الحالي: `div.app` (سطر 49) بشبكة عمودين — `aside.sidebar#sidebar` (سطر 51: بحث `#search` + فهرس `.index/#surahList`) + `main.reading#main` (سطر 80: بطاقة `.daily` لآية اليوم ثم `div.reading-row` سطر 86 بقارئ `article.mushaf/#reader` وبطاقة `aside.progress#progress` بجانبه). لا `hero` ولا `dashboard` ولا `layout` قديمة.
- يجلب نص السور بترتيب ثابت: كاش `localStorage` ← `window.OFFLINE_SURAHS` ← API `api.alquran.cloud` (`loadSurahAyahs` سطر 189).
- التعليم آية آية بالنقر يبدّل `state.read` بمفاتيح `"سورة:آية"` ويحدّث `state.log` اليومي و`state.last` (`toggleAyahRead` سطر 111).
- الإحصاء كله مشتق: النسبة = `readTotal() / TOTAL_AYAS` وتُرسم في `renderStats` (سطر 380).
- كل الحالة تُحفظ في مفتاح واحد `quran_tracker_v1` عبر `saveState` (سطر 54) بعد كل تغيير.
- العلوية `header.topbar` (سطر 22): الشعار + رابط إنستغرام `a.brand-link` (سطر 30 بخط `Manrope` في `css/style.css:104`) + روابط الأقسام `nav.top-links` (سطر 32: `#sidebar` للفهرس و`#reader` للقراءة و`#progress` للختمة) + شارة `#netStatus` (سطر 38) + زرّا الخط والثيم.

## 2. الثوابت

| الاسم | السطر | القيمة / الشكل | لماذا موجود | أين يُستخدم |
|---|---|---|---|---|
| `TOTAL_AYAS` | 7 | `6236` | أساس حساب نسبة الختمة والمتبقي (مجموع `data/surahs.json`) | `completeCurrentSurah` (سطر 303)؛ `resetKhatma` (321)؛ `renderStats` (382-384)؛ `checkKhatmaComplete` (401) |
| `KHATMA_RESET_MARGIN` | 9 | `10` | مرجع تاريخي لعتبة القرب من الإتمام (6226 فأكثر) — لا يُحتسب شيء تلقائيًا، الاحتساب يتطلب تعليم الصندوق في `resetKhatma` | تعليق توثيقي فقط حاليًا (سطر 8)؛ المنطق الفعلي في `resetKhatma` (327-332) يعتمد إقرارًا صريحًا لا العتبة |
| `LS_KEY` | 10 | `'quran_tracker_v1'` | مفتاح حالة الختمة في `localStorage` — ثابت حتى لا تضيع بيانات المستخدمين | `loadState` (46)؛ `saveState` (55) |
| `CACHE_PREFIX` | 13 | `'surah_cache_'` | بادئة مفاتيح نص السور (`surah_cache_<number>`) | `getCachedAyahs` (67)؛ `saveSurahCache` (76)؛ `cachedSurahCount` (507) |
| `BACKUP_KEY` | 12 | `'quran_tracker_backup_v1'` | نسخة أمان تُكتب قبل كل استيراد ويعيدها زر «تراجع» | `applyImport` (596)؛ `undoImport` (616-627) |
| `PROGRESS_FORMAT` | 350 | `1` | نسخة صيغة ملف التصدير — تُرفع عند تغيير شكل الملف | `collectProgress` (397)؛ `parseProgressFile` (430) |
| `PROGRESS_MAX_BYTES` | 351 | `5 * 1024 * 1024` | سقف حجم ملف الاستيراد | `handleImportFile` (645) |
| `OFFLINE_SURAHS` | 12 | `window.OFFLINE_SURAHS \|\| {}` (من `js/offline-surahs.js`: السور 1، 112، 113، 114) | العمل دون إنترنت للسور المضمّنة قبل أي جلب | `loadSurahAyahs` (192-194) |

## 3. متغيرات الحالة

| الاسم | السطر | النوع / الشكل | الدوال التي تقرؤه | الدوال التي تغيّره | لماذا |
|---|---|---|---|---|---|
| `surahs` | 16 | `Array<{number, name, english, ayahs, type}>` — فارغ ثم 114 عنصرًا | `findSurah` (60)؛ `renderList` (173)؛ `openSurah` (248)؛ `completeCurrentSurah` (299)؛ `updateSurahBadge` (134) | `init` (653) فقط | فهرس السور من `data/surahs.json` — مصدر أسماء وأعداد الآيات في كل الرسم |
| `state` | 17 | `{read: {[key]: date\|true}, last: {surah,ayah,name}\|null, khatmaCount: number, dailyGoal: number, fontSize: number, log: {[YYYY-MM-DD]: number}, theme: 'dark'\|'light'\|null, lastExportAt: string\|null}` | كل دوال القراءة والإحصاء تقريبًا (`readTotal`، `readCountOf`، `renderStats`، `bindEvents/setGoal`) | `loadState` (تهيئة أولى)؛ `markAyahRead` (111-113)؛ `toggleAyahRead` (121-124)؛ `completeCurrentSurah` (318-319)؛ `resetKhatma` (338-340)؛ `checkKhatmaComplete` (737-739)؛ `toggleTheme` (689)؛ `changeFontSize` (696)؛ `bindEvents/setGoal` (916)؛ `applyImport` (594)؛ `undoImport` (625) | الحالة الوحيدة القابلة للحفظ — تُكتب كاملة في `localStorage` عبر `saveState` |
| `currentSurah` | 18 | `number \| null` — رقم السورة المعروضة | `renderList` (179 لتحديد `active`)؛ `completeCurrentSurah` (298)؛ `resetKhatma` (339)؛ `checkKhatmaComplete` (408)؛ أزرار السابق/التالي في `bindEvents` (613، 616) | `openSurah` (247) فقط | يتتبع السورة المفتوحة: حارس السباق (`currentSurah !== number` سطر 264، 269) وتمكين زر الإتمام والتنقل |
| `$` | 21 | `(id: string) => HTMLElement` — اختصار `document.getElementById` | كل الدوال التي تلمس DOM | لا يُغيَّر (ثابت سهمي) | تقليل التكرار — يقبل `id` دون `#` |
| `cacheBarTimer` | 500 | `timeoutId \| null` | `hideCacheBar` (524)؛ `showCacheBar` (530، 552) | `hideCacheBar` (524-525)؛ `showCacheBar` (552) | مؤقت إخفاء شريط السور المحفوظة بعد 5 ثوانٍ — يُصفَّر قبل إنشاء شريط جديد لمنع التراكم |

## 4. الدوال بالترتيب

### `todayKey()` — سطر 26

- **التوقيع:** `function todayKey()`
- **ماذا تفعل وكيف:** تنشئ `new Date()` (سطر 25)؛ تستخرج الشهر +1 مُصفَّرًا برقمين (26) واليوم مُصفَّرًا (27)؛ ترجع `${year}-${month}-${day}` (28).
- **لماذا وُجدت:** مفتاح `state.log` اليومي بتوقيت المتصفح المحلي — عدّاد ورد اليوم.
- **المدخلات:** لا شيء.
- **المخرجات والتأثيرات:** ترجع نص `YYYY-MM-DD`؛ لا DOM ولا تخزين.
- **تناديها:** `markAyahRead` (104)؛ `toggleAyahRead` (ضمنيًا عبر القيمة المخزنة)؛ `completeCurrentSurah` (305)؛ `renderStats` (388). **تنادي:** لا شيء (Date فقط).

### `debounce(fn, ms = 200)` — سطر 32

- **التوقيع:** `function debounce(fn, ms = 200)`
- **ماذا تفعل وكيف:** تحجز `timer` (33)؛ ترجع دالة سهمية تمسح المؤقت السابق `clearTimeout` (35) وتضبط `setTimeout(() => fn(...args), ms)` (36).
- **لماذا وُجدت:** تقليل إعادة رسم الفهرس أثناء الكتابة في `#search`.
- **المدخلات:** `fn` الدالة المؤجلة، `ms` المهلة (افتراضي 200).
- **المخرجات والتأثيرات:** ترجع دالة مؤجلة؛ لا DOM مباشر.
- **تناديها:** `bindEvents` (588) للفّ `renderList`. **تنادي:** `fn` الممررة.

### `loadState()` — سطر 50

- **التوقيع:** `function loadState()`
- **ماذا تفعل وكيف:** تنادي `defaultState()` (46) التي تبني القيم الافتراضية `{read:{}, last:null, khatmaCount:0, dailyGoal:20, fontSize:1.9, log:{}, theme:null, lastExportAt:null}` (47)؛ تحاول `JSON.parse(localStorage.getItem(LS_KEY))` وتدمج `{...defaultState(), ...saved}` (52-53)؛ عند أي استثناء ترجع `defaultState()` (55).
- **لماذا وُجدت:** التوافق مع البيانات القديمة الناقصة — أي حقل جديد يضاف في `defaultState` أولًا بقيمة افتراضية.
- **المدخلات:** لا شيء (تقرأ `localStorage`).
- **المخرجات والتأثيرات:** ترجع كائن الحالة؛ تقرأ `localStorage` فقط.
- **تناديها:** تهيئة `state` (سطر 19)، و`undoImport` تستخدم `defaultState` مباشرة. **تنادي:** `defaultState`، `localStorage.getItem`، `JSON.parse`.

### `saveState()` — سطر 60

- **التوقيع:** `function saveState()`
- **ماذا تفعل وكيف:** سطر واحد: `localStorage.setItem(LS_KEY, JSON.stringify(state))` (55).
- **لماذا وُجدت:** نقطة الكتابة الوحيدة للحالة — تُستدعى بعد كل تغيير (تعليق سطر 53).
- **المدخلات:** لا شيء (تقرأ `state` العامة).
- **المخرجات والتأثيرات:** تكتب `quran_tracker_v1` في `localStorage`؛ لا ترجع شيئًا.
- **تناديها:** `refreshAyahUI` (126)؛ `resetKhatma` (335)؛ `checkKhatmaComplete` (405)؛ `toggleTheme` (363)؛ `changeFontSize` (370)؛ `bindEvents/setGoal` (577).

### `findSurah(number)` — سطر 59

- **التوقيع:** `function findSurah(number)`
- **ماذا تفعل وكيف:** `surahs.find((s) => s.number === number)` (60).
- **لماذا وُجدت:** جلب بيانات سورة من الفهرس برقمها في كل موضع يحتاج الاسم/العدد/النوع.
- **المدخلات:** `number` رقم السورة.
- **المخرجات:** كائن السورة أو `undefined`.
- **تناديها:** `updateSurahBadge` (134)؛ `openSurah` (248)؛ `completeCurrentSurah` (299).

### `getCachedAyahs(number)` — سطر 65

- **التوقيع:** `function getCachedAyahs(number)`
- **ماذا تفعل وكيف:** تحاول `JSON.parse(localStorage.getItem(CACHE_PREFIX + number))` (67) وترجع `cached?.ayahs` (68)؛ عند الفشل ترجع `null` (70).
- **لماذا وُجدت:** قراءة نص السورة المحفوظ بعد أول تحميل — الخطوة 1 من `loadSurahAyahs`.
- **المدخلات:** `number` رقم السورة.
- **المخرجات:** `[{number, text}]` أو `null`؛ تقرأ `localStorage` فقط.
- **تناديها:** `loadSurahAyahs` (190)؛ `completeCurrentSurah` (301 لحساب `total` دون شبكة).

### `saveSurahCache(number, ayahs)` — سطر 75

- **التوقيع:** `function saveSurahCache(number, ayahs)`
- **ماذا تفعل وكيف:** تكتب `{ayahs}` في `CACHE_PREFIX + number` (76) ثم تنادي `updateCacheBar()` (77) لتحديث نص زر الـ footer.
- **لماذا وُجدت:** حفظ النص بعد أول جلب ناجح ليعمل دون إنترنت + إبقاء عدّاد الزر حيًا.
- **المدخلات:** `number`، و`ayahs` مصفوفة `[{number, text}]`.
- **المخرجات والتأثيرات:** كتابة `localStorage` + تحديث DOM عبر `updateCacheBar`.
- **تناديها:** `loadSurahAyahs` (193 للـ offline، 200 للـ API). **تنادي:** `updateCacheBar`.

### `readTotal()` — سطر 87

- **التوقيع:** `function readTotal()`
- **ماذا تفعل وكيف:** `Object.keys(state.read).length` (82).
- **لماذا وُجدت:** إجمالي المقروء في الختمة الحالية — أساس النسبة والمتبقي وكشف الاكتمال.
- **المدخلات:** لا شيء. **المخرجات:** عدد صحيح.
- **تناديها:** `resetKhatma` (320)؛ `renderStats` (381)؛ `checkKhatmaComplete` (401).

### `readCountOf(surahNumber)` — سطر 86

- **التوقيع:** `function readCountOf(surahNumber)`
- **ماذا تفعل وكيف:** تبني بادئة `"N:"` (87) وترشّح مفاتيح `state.read` التي تبدأ بها ثم تعدّها (88).
- **لماذا وُجدت:** عدّاد كل سورة على حدة (شارة الفهرس + حساب غير المقروء في الإتمام).
- **المدخلات:** `surahNumber`. **المخرجات:** عدد آيات تلك السورة المقروءة.
- **تناديها:** `updateSurahBadge` (136)؛ `renderList` (174)؛ `completeCurrentSurah` (303).

### `surahStatusText(meta, readCount)` — سطر 93

- **التوقيع:** `function surahStatusText(meta, readCount)`
- **ماذا تفعل وكيف:** تبني `["N آية", type]` (94)؛ إن `readCount >= ayahs` تدفع `'✔'` (95) وإلا إن `> 0` تدفع `"r/N"` (96)؛ تدمج بـ `' • '` (97).
- **لماذا وُجدت:** نص `<small>` الموحد في كل عنصر فهرس.
- **المدخلات:** `meta` بيانات السورة، `readCount`. **المخرجات:** نص عربي. لا تأثيرات.
- **تناديها:** `updateSurahBadge` (137)؛ `renderList` (180).

### `markAyahRead(surahNumber, ayahNumber, surahName)` — سطر 101

- **التوقيع:** `function markAyahRead(surahNumber, ayahNumber, surahName)`
- **ماذا تفعل وكيف:** تبني المفتاح `"S:A"` (102)؛ إن موجود ترجع فورًا (103 — تمنع تضخيم عدّاد اليوم)؛ وإلا تخزن `state.read[key] = todayKey()` (105) وتضبط `state.last` (106) وتزيد `state.log[today]` (107).
- **لماذا وُجدت:** التعليم الأحادي الاتجاه (يستخدمه النقر الثاني والحلقات الجماعية) — القيمة تاريخ نصي (truthy) لإنقاص عدّاد اليوم الصحيح عند التراجع.
- **المدخلات:** أرقام السورة والآية واسم السورة. **المخرجات:** لا شيء؛ تغيّر `state` في الذاكرة فقط (الحفظ على المتصل عبر `refreshAyahUI`).
- **تناديها:** `toggleAyahRead` (121)؛ `completeCurrentSurah` (312 في حلقة). **تنادي:** `todayKey`.

### `toggleAyahRead(surahNumber, ayahNumber, surahName)` — سطر 111

- **التوقيع:** `function toggleAyahRead(surahNumber, ayahNumber, surahName)`
- **ماذا تفعل وكيف:** إن المفتاح موجود: تقرأ يومه `day` (115)؛ إن كان نصًا و`state.log[day] > 0` تنقصه (116 — القيم القديمة `true` بلا يوم تُتجاهل عمدًا)؛ تحذف المفتاح (117)؛ وتصفّر `last` إن كانت هي نفس الآية (118) ثم ترجع؛ وإلا تنادي `markAyahRead` (121).
- **لماذا وُجدت:** تبديل النقرة (تعليم ← تراجع) مع الحفاظ على سلامة عدّاد اليوم وآخر قراءة، ودعم بيانات `true` القديمة.
- **المدخلات/المخرجات:** كالسابقة؛ تغيّر `state` في الذاكرة فقط.
- **تناديها:** معالج `onclick` في `createAyahElement` (233). **تنادي:** `markAyahRead`.

### `refreshAyahUI(surahNumber)` — سطر 125

- **التوقيع:** `function refreshAyahUI(surahNumber)`
- **ماذا تفعل وكيف:** `saveState()` (126) ثم `renderStats()` (127) ثم `updateSurahBadge(surahNumber)` (128).
- **لماذا وُجدت:** خط الأنابيب الموحد بعد كل تعليم/تراجع — حفظ + إحصاء + شارة دون إعادة رسم القائمة كاملة (أداء).
- **تناديها:** معالج النقر في `createAyahElement` (234)؛ `completeCurrentSurah` (314). **تنادي:** الثلاثة المذكورة.

### `updateSurahBadge(surahNumber)` — سطر 132

- **التوقيع:** `function updateSurahBadge(surahNumber)`
- **ماذا تفعل وكيف:** تجد زر الفهرس `[data-surah="N"]` (133) و`meta` (134)؛ إن غاب أحدهما ترجع (135)؛ تحسب `readCountOf` (136) وتحدّث `<small>` عبر `surahStatusText` (137) وتبدّل صنف `done` (138).
- **لماذا وُجدت:** تحديث شارة سورة واحدة فقط — تجنّب `renderList` الكاملة عند كل نقرة.
- **التأثيرات:** تعديل DOM موضعي فقط.
- **تناديها:** `refreshAyahUI` (128). **تنادي:** `findSurah`، `readCountOf`، `surahStatusText`.

### `normalizeArabic(s)` — سطر 142

- **التوقيع:** `function normalizeArabic(s)`
- **ماذا تفعل وكيف:** سلسلة `replace`: همزات `[أإآ]` ← `ا`، `ة` ← `ه`، `ى` ← `ي`، حذف التشكيل `[ً-ٟ]` (143).
- **لماذا وُجدت:** ليجد «ابراهيم» سورة «إبراهيم» — مطابقة متسامحة.
- **تناديها:** `surahMatches` (160).

### `normalizeDigits(s)` — سطر 147

- **التوقيع:** `function normalizeDigits(s)`
- **ماذا تفعل وكيف:** تحوّل المشرقية `[٠-٩]` والفارسية `[۰-۹]` إلى لاتينية عبر `indexOf` (148)؛ تجرّد المسافات `trim` (149) والأصفار البادئة `^0+` (150).
- **لماذا وُجدت:** ليجد «٠١٨» أو « 18 » السورة 18.
- **تناديها:** `surahMatches` (157-158).

### `surahMatches(meta, query)` — سطر 154

- **التوقيع:** `function surahMatches(meta, query)`
- **ماذا تفعل وكيف:** إن لا استعلام ترجع `true` (155)؛ تحسب `q` الصغيرة (156) و`nq` المطبّعة رقميًا (157) و`isNumeric` (158)؛ ترجع OR: عربي مطبّع `includes` (160) أو إنجليزي `includes` غير حساس (161) أو رقم مطابق تمامًا `String(number) === nq` (162).
- **لماذا وُجدت:** منطق المطابقة الثلاثي (عربي/إنجليزي/رقم) للبحث الجانبي.
- **تناديها:** `renderList` (173). **تنادي:** `normalizeArabic`، `normalizeDigits`.

### `renderList(filter = '')` — سطر 167

- **التوقيع:** `function renderList(filter = '')`
- **ماذا تفعل وكيف:** تفرّغ `#surahList` (169)؛ تقصّ الفلتر (170)؛ تنشئ `DocumentFragment` (171)؛ ترشّح بـ `surahMatches` ولكل سورة: تحسب المقروء و`done` (174-175)، تنشئ `<button data-surah>` بأصناف `surah-item/active/done` (176-179)، تحشو `innerHTML` (رقم + `سورة name` + `<small>` الحالة + ✔) (180)، تربط `onclick → openSurah` (181)؛ تلحق الكل دفعة واحدة (185).
- **لماذا وُجدت:** رسم الفهرس دفعة واحدة لتقليل إعادة التدفق (أداء).
- **التأثيرات:** إعادة بناء `#surahList` كاملة.
- **تناديها:** `bindEvents` عبر البحث (588)؛ `resetKhatma` (337)؛ `checkKhatmaComplete` (407)؛ `init` (660). **تنادي:** `surahMatches`، `readCountOf`، `surahStatusText`، `openSurah` (عبر النقر).

### `loadSurahAyahs(number)` — سطر 189

- **التوقيع:** `async function loadSurahAyahs(number)`
- **ماذا تفعل وكيف:** (1) كاش → ترجعه (190-191)؛ (2) `OFFLINE_SURAHS[number]` → يحفظه `saveSurahCache` ويرجعه (192-194)؛ (3) `fetch(api.alquran.cloud/v1/surah/N/quran-uthmani)` (196)؛ إن `!ok` يرمي (197)؛ يحوّل `json.data.ayahs` إلى `[{number: numberInSurah, text}]` (199) ويحفظه (200) ويرجعه (201).
- **لماذا وُجدت:** ترتيب المصادر الثابت: محلي أولًا ثم مضمّن ثم الرسمي (طبعة `quran-uthmani` لا تُغيَّر دون طلب).
- **تناديها:** `openSurah` (261). **تنادي:** `getCachedAyahs`، `saveSurahCache`، `fetch`.

### `stripBasmalaPrefix(text)` — سطر 206

- **التوقيع:** `function stripBasmalaPrefix(text)`
- **ماذا تفعل وكيف:** تقسّم كلمات (207)؛ تأخذ أول 4 كلمات وتطبّعها (`ٱ`←`ا` وحذف التشكيل) (208)؛ إن طابقت `بسم الله الرحمن الرحيم` ترجع الباقي (209) وإلا الأصل (210).
- **لماذا وُجدت:** الـ API يُبقي البسملة في الآية 1 والعرض يضع بسملة خضراء زخرفية — التجريد يمنع التكرار. نسخة عرض فقط، الكاش لا يُمس. تُستخدم للسور عدا 1 و9.
- **تناديها:** `openSurah` (281).

### `highlightActiveSurah(number)` — سطر 214

- **التوقيع:** `function highlightActiveSurah(number)`
- **ماذا تفعل وكيف:** تزيل `active` عن الكل (215) وتضيفها لـ `[data-surah="N"]` مع `?.` الآمن (216).
- **لماذا وُجدت:** إبراز السورة المفتوحة في الفهرس.
- **تناديها:** `openSurah` (253).

### `createAyahElement(surahNumber, surahName, ayah)` — سطر 220

- **التوقيع:** `function createAyahElement(surahNumber, surahName, ayah)`
- **ماذا تفعل وكيف:** تبني المفتاح (221) وتحسب `isLast` (222)؛ تنشئ `<span.ayah>` بأصناف `read` و`last` (الثانية فقط إن مقروءة أيضًا) (224) و`id=ayah-N` (225) ونص الآية (226)؛ تلحق حبة الرقم `.ayah-num` (227-230) ومسافة (231)؛ تربط `onclick`: تبديل + `refreshAyahUI` + تبديل صنف `read` محليًا (233-235) + نقل صنف `last` للآية الأخيرة الحالية (236-239) + فحص الاكتمال (240)؛ ترجع العنصر (242).
- **لماذا وُجدت:** تغليف كل آية كعنصر نقّار يحدّث نفسه دون إعادة رسم السورة.
- **التأثيرات:** إنشاء DOM + ربط حدث؛ عند النقر: `localStorage` (عبر `refreshAyahUI`) وتعديل أصناف.
- **تناديها:** `openSurah` (285). **تنادي:** `toggleAyahRead`، `refreshAyahUI`، `checkKhatmaComplete`.

### `openSurah(number, scrollToAyah = null)` — سطر 246

- **التوقيع:** `async function openSurah(number, scrollToAyah = null)`
- **ماذا تفعل وكيف:** تضبط `currentSurah` (247)؛ تجد `meta` وترجع إن غابت (248-249)؛ ترسم العنوان `#surahTitle` والوصف `#surahMeta` (250-251) و`جاري التحميل…` (252)؛ تبرز الفهرس (253)؛ تُخرج السورة من طابور الخلفي `dequeue` وتوقفه `userActive(true)` (255-256)؛ تفعّل زر الإتمام (258)؛ تجلب `loadSurahAyahs` (261) — عند الفشل: تستأنف الخلفي `userActive(false)` (263)، حارس السباق `currentSurah !== number` (264)، رسالة الخطأ الثابتة عن السور المحفوظة (265)؛ تستأنف الخلفي (268) وحارس السباق الثاني (269)؛ تفرّغ `#reader` وتبني `Fragment` (271-273)؛ بسملة زخرفية لكل السور عدا 1 و9 + تجريد بسملة الآية 1 للعرض فقط (274-284)؛ تلحق الآيات عبر `createAyahElement` (285-286)؛ إن `scrollToAyah` تمرّر إليه بسلاسة بعد 100ms (288-292).
- **لماذا وُجدت:** الدالة المحورية لعرض سورة: عنوان + نص عثماني قابل للتعليم + تنسيق بسملة + تكامل مع التحميل الخلفي وحماية السباق.
- **المدخلات:** رقم السورة وآية اختيارية للتمرير (زر المتابعة).
- **التأثيرات:** قراءة DOM وكتابته (`#surahTitle`، `#surahMeta`، `#reader`)؛ قراءة `localStorage`/شبكة (عبر `loadSurahAyahs`)؛ إشارات لـ `window.SurahPreloader`.
- **تناديها:** نقرات الفهرس (181)؛ أزرار `data-goto` (590)؛ المتابعة (593-594)؛ السابق/التالي (613، 616)؛ `completeCurrentSurah` (315)؛ `resetKhatma` (339)؛ `checkKhatmaComplete` (408). **تنادي:** `findSurah`، `highlightActiveSurah`، `loadSurahAyahs`، `stripBasmalaPrefix`، `createAyahElement`، `SurahPreloader.dequeue/userActive`.

### `completeCurrentSurah()` — سطر 303

- **التوقيع:** `async function completeCurrentSurah()`
- **ماذا تفعل وكيف:** ترجع إن لا سورة مفتوحة أو `meta` غائبة (298-300)؛ تقرأ الكاش لحساب `total` (احتياطي `meta.ayahs`) (301-302)؛ تحسب `unread = total - readCountOf` وترجع إن صفر (303-304)؛ تقرأ عدّاد اليوم (305)؛ تعرض `showModal` بعدد غير المقروء وأثره على الورد `اليوم: X ← X+unread` (306-310)؛ إن رفض ترجع (311)؛ تعلّم 1..total بحلقة `markAyahRead` (312) وتضبط `last` على آخر آية (313)؛ `refreshAyahUI` (314)؛ إن لم تكتمل الختمة تعيد `openSurah` (315 — عند الاكتمال يترك الرسم لـ `checkKhatmaComplete`).
- **لماذا وُجدت:** إتمام السورة دفعة واحدة بتأكيد يعرض الأثر — مع حماية (لا شيء دون سورة/دون جديد، زر `disabled` حتى تُفتح سورة في `index.html:145`).
- **التأثيرات:** `state` + حفظ + إحصاء + إعادة رسم القارئ؛ نافذة تأكيد.
- **تناديها:** زر `#completeSurahBtn` (611). **تنادي:** `findSurah`، `getCachedAyahs`، `readCountOf`، `todayKey` (ضمنيًا)، `showModal`، `markAyahRead`، `refreshAyahUI`، `checkKhatmaComplete`، `openSurah`.

### `resetKhatma()` — سطر 325

- **التوقيع:** `async function resetKhatma()`
- **ماذا تفعل وكيف:** تحسب `total` و`missing` (320-321)؛ تعرض `showModal` خطرًا أحمر (`danger:true`) بالنص الصريح `قرأت N — ينقصك M` + صندوق إقرار `أحتسبها… — أقر بأنني واعٍ` فقط عندما `0 < total < TOTAL_AYAS` (322-328)؛ تفكّ النتيجة `{ok, checked}` (329-330) وترجع إن رفض (331)؛ إن `checked` تزيد `khatmaCount` (332)؛ تصفّر `read` و`last` (333-334) وتحفظ (335)؛ تفرّغ البحث وتعيد رسم القائمة والإحصاء (336-338)؛ تعيد فتح الحالية إن وُجدت (339).
- **لماذا وُجدت:** تصفير الختمة لبدء جديدة — احتساب المكتملة يتطلب تعليمًا صريحًا غير معلَّم افتراضيًا، وإلا تصفير دون احتساب.
- **التأثيرات:** `localStorage` + `#search` + `#surahList` + الإحصاء + `#reader`.
- **تناديها:** زر `#resetBtn` (596). **تنادي:** `readTotal`، `showModal`، `saveState`، `renderList`، `renderStats`، `openSurah`.

### نقل التقدم — سطر 348

قسم مستقل بين `resetKhatma` و`=== الوضع الليلي` (348-668): ملف JSON محلي بلا شبكة. الثوابت: `PROGRESS_FORMAT` (350) و`PROGRESS_MAX_BYTES` (351)، والمتغيران `pendingImportMode` (352) و`undoTimer` (353).

| الدالة | السطر | ماذا تفعل |
|---|---|---|
| `isDayString` | 356 | تتحقق من `YYYY-MM-DD` حقيقي (ترفض 2026-02-31) |
| `isFutureDay` | 363 | ترفض التواريخ بعد الغد |
| `daysAgoText` | 372 | صياغة «قبل يوم/يومين/N يومًا» |
| `renderTransferStatus` | 384 | تكتب سطر «آخر نسخة» من `state.lastExportAt` |
| `collectProgress` | 393 | تبني `{app,kind,version,exportedAt,state}` بالحقول السبعة فقط |
| `exportProgress` | 412 | تنزّل `noor-progress-YYYY-MM-DD.json` عبر Blob ثم تحدّث `lastExportAt` |
| `parseProgressFile` | 430 | تحقق كامل (سقف، مفاتيح، فهرس، تواريخ، إعدادات) قبل أي أثر |
| `sanitizeLog` | 502 | تُبقي تواريخ وأعدادًا صالحة فقط |
| `mergeRead` | 514 | اتحاد الآيات بأقدم تاريخ (و`true` تُستبدل بتاريخ) |
| `mergeLog` | 526 | إعادة حساب الأيام من تواريخ `read` ثم `max` مع المحفوظ — بلا تضاعف |
| `refreshAfterImport` | 540 | إعادة رسم الهدف/الخط/الثيم/الفهرس/الإحصاء/القارئ |
| `showImportPreview` | 551 | معاينة عبر `showModal` (استبدال = danger) ثم `applyImport` |
| `applyImport` | 574 | نسخة أمان في `BACKUP_KEY` (596) ثم دمج/استبدال وزر تراجع 10 ثوانٍ |
| `undoImport` | 616 | تستعيد `backup.state` (625) وتحذف النسخة |
| `pickImportFile` | 638 | تفتح `#importFile` بالوضع المختار |
| `handleImportFile` | 647 | سقف الحجم، قراءة، `parseProgressFile`، ثم المعاينة |

- **الدمج:** `read` اتحاد + أقدم تاريخ؛ `khatmaCount = max`؛ `last` المحلي إن وُجد؛ `dailyGoal/fontSize/theme` محلية. **الاستبدال:** كل الحقول والإعدادات من الملف و`lastExportAt = exportedAt`.
- لا يُستدعى `checkKhatmaComplete` بعد الاستيراد (ليس قراءة جديدة).
- `applyGoalUI` (908) تزامن `#dailyGoal` بعد الاستيراد بدل ضبطه مرة واحدة في `bindEvents`.

### `currentTheme()` — سطر 675

- **التوقيع:** `function currentTheme()`
- **ماذا تفعل وكيف:** إن `state.theme` محفوظ `dark/light` ترجعه (345)؛ وإلا تقرأ `matchMedia('(prefers-color-scheme: dark)')` وترجع `dark` أو `light` (346).
- **لماذا وُجدت:** الثيم الفعلي: صريح محفوظ أو تلقائي حسب النظام عندما `theme === null`.
- **تناديها:** `applyTheme` (351)؛ `toggleTheme` (689).

### `applyTheme()` — سطر 681

- **التوقيع:** `function applyTheme()`
- **ماذا تفعل وكيف:** تحسب `dark` (351)؛ تضبط/تزيل `documentElement.dataset.theme` (352-353)؛ تحدّث زر `#themeToggle` (أيقونة `☀/☾` و`aria-pressed`) (354-357).
- **لماذا وُجدت:** تطبيق الثيم عبر `data-theme` على `html` (يكمله سكربت منع الوميض في `index.html:9`).
- **التأثيرات:** سمة DOM + نص الزر وحالته لقارئ الشاشة.
- **تناديها:** `toggleTheme` (364)؛ مستمع تغيّر النظام (609)؛ `init` (659 قبل الرسم). **تنادي:** `currentTheme`.

### `toggleTheme()` — سطر 692

- **التوقيع:** `function toggleTheme()`
- **ماذا تفعل وكيف:** تعكس الثيم الفعلي وتحفظه صراحة (يلغي التلقائي) (362) ثم تحفظ وتطبّق (363-364).
- **التأثيرات:** `state.theme` + حفظ + DOM.
- **تناديها:** زر `#themeToggle` (606). **تنادي:** `currentTheme`، `saveState`، `applyTheme`.

### `changeFontSize(step)` — سطر 368

- **التوقيع:** `function changeFontSize(step)`
- **ماذا تفعل وكيف:** تجمع `step` على الحالية (احتياطي 1.9) وتقيّد `[1.2, 3]` (369) ثم تحفظ وتطبّق (370-371).
- **لماذا وُجدت:** تكبير/تصغير خط القارئ بحدّين ثابتين (rem).
- **التأثيرات:** `state.fontSize` + حفظ + متغير CSS.
- **تناديها:** زرّا `#fontPlus/#fontMinus` (604-605). **تنادي:** `saveState`، `applyReaderFontSize`.

### `applyReaderFontSize()` — سطر 706

- **التوقيع:** `function applyReaderFontSize()`
- **ماذا تفعل وكيف:** `reader.style.setProperty('--reader-size', fontSize + 'rem')` (376).
- **لماذا وُجدت:** الضبط عبر متغير CSS حصرًا — `style.fontSize` المباشر ممنوع لأنه يقتل `clamp()` المتجاوب.
- **التأثيرات:** خاصية CSS على `#reader` فقط.
- **تناديها:** `changeFontSize` (371)؛ `init` (662).

### `renderStats()` — سطر 711

- **التوقيع:** `function renderStats()`
- **ماذا تفعل وكيف:** `total = readTotal()` (381) و`percent = total/TOTAL_AYAS*100` (382)؛ تكتب `#percent` بصيغتين عشريتين (383) و`#statsLine` (مقروء/كلي • متبقي) (384) وعرض `#progressFill` (385) و`aria-valuenow/max` على `#khatmaProgress` (386-387) و`#todayCount` (اليوم: log ← goal) (388) و`#khatmaCount` (389)؛ فرع `last`: زر المتابعة `تابع: name آية N` و`آخر قراءة: سورة…` (390-392) أو الافتراضي `تابع القراءة / لم تبدأ…` (393-396).
- **لماذا وُجدت:** لوحة الختمة الوحيدة — نسبة وشريط وورد اليوم وآخر قراءة وعدد الختمات، مع `aria-live` وإمكانية وصول.
- **التأثيرات:** كتابة 8 عناصر DOM (`#percent`، `#statsLine`، `#progressFill`، `#khatmaProgress` سمتان، `#todayCount`، `#khatmaCount`، `#continueBtn`، `#lastReadLine`)؛ لا تخزين.
- **تناديها:** `refreshAyahUI` (127)؛ `resetKhatma` (338)؛ `checkKhatmaComplete` (406)؛ `bindEvents/setGoal` (578)؛ `init` (661). **تنادي:** `readTotal`، `todayKey`.

### `checkKhatmaComplete()` — سطر 738

- **التوقيع:** `async function checkKhatmaComplete()`
- **ماذا تفعل وكيف:** إن `readTotal() < 6236` ترجع `false` دون أثر (401)؛ وإلا: تزيد العداد (402) وتصفّر `read` و`last` (403-404) وتحفظ (405) وتعيد رسم الإحصاء والقائمة والقارئ (406-408)؛ تعرض نافذة تهنئة بزر واحد `single:true` بعدد الختمات (409-414)؛ ترجع `true` (415).
- **لماذا وُجدت:** الاحتفال التلقائي الوحيد عند بلوغ 6236 — يصفّر أولًا ثم يهنئ ويبدأ ختمة جديدة تلقائيًا.
- **التأثيرات:** `state` + حفظ + 3 رسومات + نافذة.
- **تناديها:** نقرة الآية (240)؛ `completeCurrentSurah` (315). **تنادي:** `readTotal`، `saveState`، `renderStats`، `renderList`، `openSurah`، `showModal`.

### `showModal({title, body, confirmText, danger, single, checkboxLabel})` — سطر 422

- **التوقيع:** `function showModal({...})` ترجع `Promise<boolean | {ok, checked}>`
- **ماذا تفعل وكيف:** تحفظ التركيز السابق (424)؛ تبني `overlay > card[role=alertdialog][aria-modal]` + عنوان `h2#modalTitle` ووصف `p#modalDesc` مربوطين بـ `aria-labelledby/describedby` (425-439)؛ صندوق إقرار اختياري `label.modal-check > checkbox + span` غير معلَّم (440-451)؛ زر تأكيد `btn-danger/btn-primary` (454-458) وزر `تراجع btn-quiet` إلا في `single` (459-466)؛ تلحق بالـ `body` وتمنع التمرير (468-470)؛ `close(value)` تزيل وتمسح المنع وتعيد التركيز وتحلّ الوعد (بـ `{ok, checked}` عند وجود صندوق) (472-477)؛ تعطيل زر التأكيد حتى تعليم الصندوق (479-482)؛ ربط التأكيد/التراجع (483-484)؛ النقر خارج البطاقة يلغي إلا في `danger` (485)؛ `Esc` يلغي وحبس `Tab` داخل البطاقة (486-494)؛ التركيز الأولي على التراجع في الخطر وإلا التأكيد (495).
- **لماذا وُجدت:** نظام النوافذ الوحيد بدل `alert/confirm` الأصليين (ممنوعان) — تأكيد خطر أو إشعار بزر واحد، مع حبس تركيز و`Esc` وإعادة تركيز.
- **المدخلات/المخرجات:** خيارات مفككة أعلاه؛ تحلّ بـ `boolean` عادة أو `{ok, checked}` مع صندوق.
- **التأثيرات:** DOM مؤقت + `body.overflow` + إدارة التركيز.
- **تناديها:** `completeCurrentSurah` (306)؛ `resetKhatma` (322)؛ `checkKhatmaComplete` (409).

### `cachedSurahCount()` — سطر 841

- **التوقيع:** `function cachedSurahCount()`
- **ماذا تفعل وكيف:** حلقة 1..114 تعدّ مفاتيح `CACHE_PREFIX+i` الموجودة (504-509)؛ أي استثناء يوقف العدّ (508).
- **لماذا وُجدت:** عدد السور المحفوظة بفحص متزامن سريع — يغذي الزر والشريط.
- **تناديها:** `updateCacheBar` (514).

### `updateCacheBar()` — سطر 851

- **التوقيع:** `function updateCacheBar()`
- **ماذا تفعل وكيف:** تحسب `n` (514)؛ تحدّث `#cacheBarBtn` (`السور المحفوظة: N / 114`) (515-516)؛ إن غاب `#cacheBar` ترجع (518)؛ وإلا تحدّث `.cache-text` وعرض `.cache-fill` بنسبة `n/114` (519-520).
- **لماذا وُجدت:** إبقاء نص الزر وشريط الحالة حيّين بعد كل حفظ وكل تقدّم خلفي.
- **التأثيرات:** كتابة DOM فقط.
- **تناديها:** `saveSurahCache` (77)؛ `showCacheBar` (551)؛ حدث `surah-cache-progress` (603)؛ `init` (664 — الزر فقط). **تنادي:** `cachedSurahCount`.

### `hideCacheBar()` — سطر 861

- **التوقيع:** `function hideCacheBar()`
- **ماذا تفعل وكيف:** تمسح المؤقت وتصفّره (524-525) وتزيل `#cacheBar` بـ `?.` (526).
- **لماذا وُجدت:** إخفاء الشريط (يدوي بزر ✕ أو تلقائي بعد 5 ثوانٍ أو قبل إنشاء جديد).
- **تناديها:** زر ✕ (548)؛ مؤقت الـ 5 ثوانٍ (552)؛ بداية `showCacheBar` (530).

### `showCacheBar()` — سطر 867

- **التوقيع:** `function showCacheBar()`
- **ماذا تفعل وكيف:** تزيل القديم أولًا (530)؛ تبني `#cacheBar.cache-bar[role=status]` من نص + مسار تعبئة + زر إغلاق `✕` (531-549)؛ تلحق بالـ `body` (550)؛ تحدّث الأرقام (551)؛ تضبط مؤقت الإخفاء 5000ms (552).
- **لماذا وُجدت:** شريط حالة يدوي فقط بزر الـ footer — لا ظهور تلقائي في `init` (تعليق سطر 499).
- **التأثيرات:** إنشاء DOM + مؤقت.
- **تناديها:** زر `#cacheBarBtn` (597). **تنادي:** `hideCacheBar`، `updateCacheBar`.

### `updateNetStatus()` — سطر 894

- **التوقيع:** `function updateNetStatus()`
- **ماذا تفعل وكيف:** تجد `#netStatus` وترجع إن غابت (557-558)؛ إن متصل: `hidden=true` وتزيل `offline` (559-561)؛ وإلا: تظهرها بنص `أنت تعمل الآن دون اتصال…` وتضيف `offline` (562-566).
- **لماذا وُجدت:** شارة الاتصال — مخفية عند الاتصال، ظاهرة فقط دون إنترنت (`index.html:38`).
- **تناديها:** `bindEvents` (599) وحدثا `online/offline` (600-601).

### `bindEvents()` — سطر 916

- **التوقيع:** `function bindEvents()`
- **ماذا تفعل وكيف:** تهيئ `#dailyGoal` نصًا و`aria-valuenow` (571-572)؛ تعرّف `setGoal(v)` مقيّدة `[1,500]` مع كتابة وحفظ وإحصاء (573-579)؛ تربط: `goalUp/Down` (580-581)، أسهم `dailyGoal` (↑/→ +1، ↓/← −1، Home→1، End→500) (582-587)، بحث `debounced 200ms → renderList` (588)، أزرار `data-goto` (589-591)، متابعة (آخر سورة+آية أو 1) (592-595)، `resetBtn → resetKhatma` (596)، `cacheBarBtn → showCacheBar` (597)، `online/offline → updateNetStatus` (599-601)، `surah-cache-progress → updateCacheBar` (603)، خط (604-605)، ثيم (606) + تتبع النظام في الوضع التلقائي فقط (608-610)، إتمام السورة (611)، سابق/تالي بحراسة الحدود (612-617)، طي الفهرس `collapsed` مع نص عرض/طي و`aria-expanded` (618-624).
- **لماذا وُجدت:** ربط كل أزرار الواجهة مرة واحدة من `init` (تعليق سطر 569).
- **التأثيرات:** مستمعو أحداث + تهيئة `#dailyGoal`.
- **تناديها:** `init` (658) فقط. **تنادي (غير مباشر):** كل ما سبق عبر الأحداث.

### `renderDaily()` — سطر 978

- **التوقيع:** `async function renderDaily()`
- **ماذا تفعل وكيف:** تجلب `data/daily.json` (630) وترمي إن `!ok` (631)؛ تقبل مصفوفة مباشرة أو `{daily}` (633) — والملف الحالي كائن `{daily: [{text, ref} × 30]}` — وترمي إن فارغة (634)؛ تحسب يوم السنة `floor((now - Jan0)/86400000)` (635-636)؛ تختار `list[day % len]` اختيارًا حتميًا (637) وترمي إن بلا نص (638)؛ تكتب `#dailyText` و`#dailyRef` (`سورة ref`) (639-640)؛ عند أي فشل تكتب `تعذر تحميل آية اليوم.` (642-643).
- **أين تُعرض:** بطاقة `section.daily` فوق القارئ (`index.html:82-85`): شارة ثابتة `span.daily-badge` (سطر 83) + سطر النص `p.daily-text` (سطر 84) الذي يضم `#dailyText` ويليه مرجعه ملاصقًا `#dailyRef.daily-ref` (داخل نفس العنصر لا عنصر `flex` منفصل عند الحافة، `dir="auto"` للنص المختلط). الأنماط في `css/style.css:173-176` (صف `align-items:center` بحشوة `--pad-inline` وفجوة `--gap-md` حسب نظام الشرائط).
- **لماذا وُجدت:** آية اليوم — اختيار حتمي حسب يوم السنة (`dayOfYear % الطول`) يعمل دون إنترنت بعد أول تحميل.
- **التأثيرات:** كتابة `#dailyText` و`#dailyRef` فقط.
- **تناديها:** `init` (663 دون انتظار).

### `init()` — سطر 999

- **التوقيع:** `async function init()`
- **ماذا تفعل وكيف:** تجلب `data/surahs.json` (651) وترمي إن `!ok` (652) وتحفظ في `surahs` (653)؛ عند الفشل تكتب `تعذر تحميل فهرس السور.` في `#surahList` وترجع (654-656)؛ ثم بالترتيب: `bindEvents` (658)، `applyTheme` قبل الرسم لمنع الوميض (659)، `renderList` (660)، `renderStats` (661)، `applyReaderFontSize` (662)، `renderDaily` دون انتظار (663)، `updateCacheBar` للزر فقط (664)، تثبيت التمرير أعلى الصفحة (665)، بدء `SurahPreloader.start(last.surah || 1)` (666)؛ لا فتح تلقائي لسورة (667).
- **لماذا وُجدت:** نقطة الدخول — تحميل الفهرس ثم رسم كل شيء. تحتاج خادمًا محليًا لأن `fetch` يُحجب عبر `file://` (تعليق سطر 648).
- **التأثيرات:** كل رسومات الإقلاع + بدء التحميل الخلفي.
- **تناديها:** الاستدعاء المباشر سطر 670. **تنادي:** كل رسومات الإقلاع + `SurahPreloader.start`.

## 5. مفاتيح `localStorage` وشكلها

### `quran_tracker_v1` (سطر 10، يُقرأ 50-53، يُكتب 60-61)

```js
{
  read: { "18:5": "2026-10-14", /* … — قيم true القديمة مقبولة كـ truthy */ },
  last: { surah: 18, ayah: 5, name: "الكهف" }, // أو null
  khatmaCount: 0,
  dailyGoal: 20,   // يُقيَّد 1-500 في setGoal (سطر 919)
  fontSize: 1.9,   // rem — يُقيَّد 1.2-3 في changeFontSize (سطر 696)
  log: { "2026-10-14": 7 }, // بتوقيت المتصفح المحلي (todayKey سطر 26)
  theme: null,     // null تلقائي | 'dark' | 'light'
  lastExportAt: null // ISO لآخر تصدير من هذا الجهاز أو null
}
```

- الافتراضيات في `defaultState` (سطر 47)؛ الدمج `{...defaultState(), ...saved}` (53) يحمي البيانات القديمة.
- `read`: المفتاح `"سورة:آية"` والقيمة تاريخ التعليم (نص) — العدّ `Object.keys().length` (سطر 88). التراجع ينقص `log[day]` فقط عندما القيمة نصًا (سطر 123).
- `last`: تُصفَّر عند التراجع عن نفس الآية (124) وعند التصفير/الاكتمال (340، 742).
- `lastExportAt`: يُحدَّث بعد كل تصدير (سطر 423)، ويأخذه الاستبدال من `exportedAt` الملف، ولا يتغير بالدمج.

### `quran_tracker_backup_v1` (سطر 12)

```js
{ savedAt: "2026-10-19T09:12:00.000Z", state: { … نفس شكل quran_tracker_v1 … } }
```

- يُكتب في `applyImport` (سطر 599) قبل أي تعديل، يقرأه `undoImport` (619)، ويُحذف بعد التراجع (630). يبقى بعد انتهاء مهلة زر التراجع (10 ثوانٍ) حتى استيراد تالٍ.

### `surah_cache_<number>` (بادئة سطر 13)

```js
{ ayahs: [{ number: 1, text: "…" }, …] }
```

- يُقرأ في `getCachedAyahs` (71-72)، يُكتب في `saveSurahCache` (81)، يُعدّ في `cachedSurahCount` (841).

## 6. خريطة النداءات الرئيسية

```text
init (999)
├─ fetch data/surahs.json → surahs (1001-1003)
├─ bindEvents (1008)
│   ├─ search(input, debounce 200ms) → renderList → surahMatches → normalizeArabic/normalizeDigits (932)
│   ├─ [data-goto] → openSurah (933-934)
│   ├─ continueBtn → openSurah(last.surah, last.ayah) أو openSurah(1) (936-939)
│   ├─ resetBtn → resetKhatma → showModal → saveState/renderList/renderStats/openSurah (940)
│   ├─ cacheBarBtn → showCacheBar → updateCacheBar → cachedSurahCount (941)
│   ├─ exportBtn → exportProgress → collectProgress → Blob/download (943)
│   ├─ importMerge/ReplaceBtn → pickImportFile → #importFile (944-945)
│   ├─ importFile change → handleImportFile → parseProgressFile → showImportPreview → applyImport (946)
│   ├─ undoImportBtn → undoImport → quran_tracker_backup_v1 (947)
│   ├─ online/offline → updateNetStatus (948-951)
│   ├─ surah-cache-progress → updateCacheBar (953)
│   ├─ fontPlus/Minus → changeFontSize → applyReaderFontSize (954-955)
│   ├─ themeToggle → toggleTheme → currentTheme/applyTheme (956)
│   ├─ completeSurahBtn → completeCurrentSurah → showModal → markAyahRead… → refreshAyahUI → checkKhatmaComplete → openSurah (961)
│   └─ prevSurah/nextSurah → openSurah(N±1) (962-967)
├─ applyTheme → currentTheme (1009)
├─ renderList → surahMatches/readCountOf/surahStatusText (1010)
├─ renderStats → readTotal/todayKey (1011)
├─ applyReaderFontSize (1012)
├─ renderDaily — fetch data/daily.json → #dailyText/#dailyRef (1013)
├─ updateCacheBar — نص الزر فقط (1014)
├─ renderTransferStatus — سطر «آخر نسخة» (1015)
├─ navigator.storage.persisted → persist (1017-1021)
└─ SurahPreloader.start(last.surah || 1) (1025-1027)

openSurah (252)
├─ loadSurahAyahs → getCachedAyahs / OFFLINE_SURAHS+saveSurahCache / fetch API+saveSurahCache (267)
├─ highlightActiveSurah (259)
├─ stripBasmalaPrefix للآية 1 (عدا 1 و9) (287)
└─ createAyahElement لكل آية (291)
    └─ onclick: toggleAyahRead (239) → refreshAyahUI (→ saveState/renderStats/updateSurahBadge) → نقل صنف last → checkKhatmaComplete
        └─ عند 6236: تصفير + renderStats/renderList/openSurah + showModal تهنئة (738-754)
```
