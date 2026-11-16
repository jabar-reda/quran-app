# توثيق `js/app.js` — نور: مصحف الختمة

> شرح شفرة `app.js` فقط (1265 سطرًا). كل رقم سطر يشير إلى الملف الحالي. لا يصف المشروع عامة — راجع `README.md` لذلك.
> صيغة ملف نقل التقدم v2 موثقة تفصيلًا في `docs/PROGRESS-FILE.md`.

## 1. نظرة سريعة

- `js/app.js` هو كل منطق التطبيق (Vanilla JS بلا اعتماديات): يحمّل فهرس 114 سورة من `data/surahs.json` ويرسمه في `#surahList` (`init` سطر 1230).
- هيكل `index.html` الحالي: `div.app` (سطر 52) بشبكة عمودين — `aside.sidebar#sidebar` (سطر 54: بحث `#search` سطر 59 + فهرس `nav.index` سطر 70 بعنوانه وعدّاد `#surahCount` سطر 74 وقائمة `#surahList` سطر 79) + `main.reading#main` (سطر 84: شريط المتابعة `#trackStrip` سطر 86 ثم بطاقة `.daily` لآية اليوم سطر 88 ثم `div.reading-row` سطر 92 بقارئ `article.mushaf/#reader` سطر 94/110 وبطاقة `aside.progress#progress` سطر 120 بجانبه). لا `hero` ولا `dashboard` ولا `layout` قديمة.
- يجلب نص السور بترتيب ثابت: كاش `localStorage` ← `window.OFFLINE_SURAHS` ← API `api.alquran.cloud` (`loadSurahAyahs` سطر 216).
- التعليم آية آية بالنقر يبدّل `state.read` بمفاتيح `"سورة:آية"` ويحدّث `state.log` اليومي و`state.last` (`toggleAyahRead` سطر 124).
- الإحصاء كله مشتق: النسبة = `readTotal() / TOTAL_AYAS` وتُرسم في `renderStats` (سطر 942).
- عدّاد رأس الفهرس «X / 114 سورة» حي أيضًا: يحسبه `completedSurahCount` (سطر 156) ويملؤه `updateSurahIndexCount` (سطر 161)، ويُستدعى مع كل تعليم/تراجع (عبر `refreshAyahUI` سطر 142) وبعد كل رسم للقائمة (`renderList` سطر 212).
- كل الحالة تُحفظ في مفتاح واحد `quran_tracker_v1` عبر `saveState` (سطر 67) بعد كل تغيير.
- العلوية `header.topbar` (سطر 30): الشعار + روابط الأقسام `nav.top-links` (سطر 38: `#sidebar` للفهرس و`#reader` للقراءة و`#progress` للختمة) + شارة `#netStatus` (سطر 44) + زر الثيم `#themeToggle` (سطر 47)؛ زرّا الخط في `.reader-font` برأس القارئ (`index.html:103-106`).
- نقل التقدم: ملف JSON بصيغة v2 (`PROGRESS_FORMAT` سطر 372) يحمل `state.ayahs` مرتبة بدل خريطة `read`، مع غلاف وصفي (`appVersion`/`exportedAtLocal`/`timezone`/`source`/`device`/`summary`) لا يدخل الحالة. التصدير `exportProgress` (سطر 596)، والاستيراد `parseProgressFile` (سطر 615) ثم `applyImport` (سطر 805).

## 2. الثوابت

| الاسم | السطر | القيمة / الشكل | لماذا موجود | أين يُستخدم |
|---|---|---|---|---|
| `TOTAL_AYAS` | 7 | `6236` | أساس حساب نسبة الختمة والمتبقي (مجموع `data/surahs.json`) | `resetKhatma` (348، 351، 354)؛ `buildSummary` (556-558)؛ `renderStats` (944، 946)؛ `checkKhatmaComplete` (970)؛ `ayahsToRead` (501-502)؛ `parseProgressFile` (645) |
| `KHATMA_RESET_MARGIN` | 9 | `10` | مرجع تاريخي لعتبة القرب من الإتمام (6226 فأكثر) — لا يُحتسب شيء تلقائيًا، الاحتساب يتطلب تعليم الصندوق في `resetKhatma` | تعليق توثيقي فقط (سطر 8)؛ المنطق الفعلي في `resetKhatma` (349-355) يعتمد إقرارًا صريحًا لا العتبة |
| `LS_KEY` | 10 | `'quran_tracker_v1'` | مفتاح حالة الختمة في `localStorage` — ثابت حتى لا تضيع بيانات المستخدمين | `loadState` (59)؛ `saveState` (68) |
| `BACKUP_KEY` | 12 | `'quran_tracker_backup_v1'` | نسخة أمان تُكتب قبل كل استيراد ويعيدها زر «تراجع» | `applyImport` (830)؛ `undoImport` (850-861) |
| `CACHE_PREFIX` | 13 | `'surah_cache_'` | بادئة مفاتيح نص السور (`surah_cache_<number>`) | `getCachedAyahs` (80)؛ `saveSurahCache` (89)؛ `cachedSurahCount` (1076) |
| `OFFLINE_SURAHS` | 14 | `window.OFFLINE_SURAHS \|\| {}` (من `js/offline-surahs.js`: السور 1، 112، 113، 114) | العمل دون إنترنت للسور المضمّنة قبل أي جلب | `loadSurahAyahs` (219-222) |
| `PROGRESS_FORMAT` | 372 | `2` | نسخة صيغة ملف التصدير — تُرفع عند تغيير شكل الملف؛ الاستيراد يرفض ما هو أعلى منها (627-629) | `collectProgress` (575)؛ `parseProgressFile` (627) |
| `APP_VERSION` | 374 | `'1.0.0'` | إصدار التطبيق المعلن داخل الملف — **وصفي فقط** ولا يدخل الحالة | `collectProgress` (576)؛ `parseProgressFile` (694) داخل `meta` |
| `PROGRESS_MAX_BYTES` | 375 | `5 * 1024 * 1024` | سقف حجم ملف الاستيراد (5MB) | `handleImportFile` (880) |
| `SOURCE_LABELS` | 377 | `{ localhost: 'محلي', web: 'ويب', pwa: 'مثبت', apk: 'APK' }` | ترجمة أنواع المصدر في معاينة الاستيراد ومنع أي نوع خارج القائمة | `parseProgressFile` (684)؛ `describeImportMeta` (720) |

## 3. متغيرات الحالة

| الاسم | السطر | النوع / الشكل | الدوال التي تقرؤه | الدوال التي تغيّره | لماذا |
|---|---|---|---|---|---|
| `surahs` | 18 | `Array<{number, name, english, ayahs, type}>` — فارغ ثم 114 عنصرًا | `findSurah` (73)؛ `renderList` (199)؛ `openSurah` (275)؛ `completeCurrentSurah` (326)؛ `updateSurahBadge` (148)؛ `completedSurahCount` (157)؛ `updateSurahIndexCount` (164)؛ `buildSummary` (553)؛ `ayahsToRead` (516) | `init` (1234) فقط | فهرس السور من `data/surahs.json` — مصدر أسماء وأعداد الآيات في كل الرسم |
| `state` | 19 | `{read: {[key]: date\|true}, last: {surah,ayah,name}\|null, khatmaCount: number, dailyGoal: number, fontSize: number, log: {[YYYY-MM-DD]: number}, theme: 'dark'\|'light'\|null, lastExportAt: string\|null}` | كل دوال القراءة والإحصاء تقريبًا (`readTotal`، `readCountOf`، `completedSurahCount` عبر `readCountOf`، `renderStats`، `bindEvents/setGoal`) | `loadState` (تهيئة أولى)؛ `markAyahRead` (118-120)؛ `toggleAyahRead` (129-131)؛ `completeCurrentSurah` (339-340)؛ `resetKhatma` (359-361)؛ `checkKhatmaComplete` (971-973)؛ `toggleTheme` (924)؛ `changeFontSize` (931)؛ `bindEvents/setGoal` (1150)؛ `exportProgress` (608)؛ `applyImport` (832)؛ `undoImport` (859) | الحالة الوحيدة القابلة للحفظ — تُكتب كاملة في `localStorage` عبر `saveState` |
| `currentSurah` | 20 | `number \| null` — رقم السورة المعروضة | `renderList` (206 لتحديد `active`)؛ `completeCurrentSurah` (325-328)؛ `resetKhatma` (366)؛ `checkKhatmaComplete` (977)؛ أزرار السابق/التالي في `bindEvents` (1193-1198) | `openSurah` (274) فقط | يتتبع السورة المفتوحة: حارس السباق (`currentSurah !== number` سطر 291، 296) وتمكين زر الإتمام والتنقل |
| `$` | 23 | `(id: string) => HTMLElement` — اختصار `document.getElementById` | كل الدوال التي تلمس DOM | لا يُغيَّر (ثابت سهمي) | تقليل التكرار — يقبل `id` دون `#` |
| `pendingImportMode` | 378 | `'merge' \| 'replace'` | `handleImportFile` (901) | `pickImportFile` (870) | الوضع المختار قبل فتح منتقي الملف — يحدد المعاينة والتنفيذ |
| `undoTimer` | 379 | `timeoutId \| null` | `applyImport` (840، 841-843)؛ `undoImport` (862) | `applyImport` (841) | مؤقت إخفاء زر التراجع بعد 10 ثوانٍ — يُصفَّر قبل كل استيراد |
| `cacheBarTimer` | 1069 | `timeoutId \| null` | `hideCacheBar` (1093)؛ `showCacheBar` (1121) | `hideCacheBar` (1093-1094)؛ `showCacheBar` (1121) | مؤقت إخفاء شريط السور المحفوظة بعد 5 ثوانٍ — يُصفَّر قبل إنشاء شريط جديد لمنع التراكم |

## 4. الدوال بالترتيب

### `pad2(n)` — سطر 26

- **التوقيع:** `function pad2(n)`
- **ماذا تفعل وكيف:** تحوّل الرقم إلى نص بـ `String(n)` وتضيف صفرًا بادئًا حتى منزلتين عبر `padStart(2, '0')` (سطر 27).
- **لماذا وُجدت:** أساس موحد لكل طوابع التاريخ (`YYYY-MM-DD`) والوقت (`HH:mm:ss`) والإزاحة الزمنية.
- **المدخلات:** عدد أو نص رقمي. **المخرجات:** نص منزلتين.
- **تناديها:** `dateKeyOf` (32)؛ `localStamp` (418)؛ `timezoneInfo` (430). **تنادي:** لا شيء.

### `dateKeyOf(date)` — سطر 31

- **التوقيع:** `function dateKeyOf(date)`
- **ماذا تفعل وكيف:** تبني `${getFullYear()}-${pad2(getMonth()+1)}-${pad2(getDate())}` (سطر 32) — توقيت المتصفح المحلي لا UTC.
- **لماذا وُجدت:** مفتاح يوم محلي واحد لكل السجل والطوابع، بدل تكرار بناء التاريخ.
- **المدخلات:** كائن `Date`. **المخرجات:** نص `YYYY-MM-DD`.
- **تناديها:** `todayKey` (37)؛ `isFutureDay` (392)؛ `localStamp` (418)؛ `buildSummary` (548). **تنادي:** `pad2`.

### `todayKey()` — سطر 36

- **التوقيع:** `function todayKey()`
- **ماذا تفعل وكيف:** ترجع `dateKeyOf(new Date())` (سطر 37).
- **لماذا وُجدت:** مفتاح `state.log` اليومي بتوقيت المتصفح المحلي — عدّاد ورد اليوم.
- **المدخلات:** لا شيء.
- **المخرجات والتأثيرات:** ترجع نص `YYYY-MM-DD`؛ لا DOM ولا تخزين.
- **تناديها:** `markAyahRead` (117)؛ `completeCurrentSurah` (332)؛ `renderStats` (950، 962)؛ `buildSummary` (539). **تنادي:** `dateKeyOf`.

### `debounce(fn, ms = 200)` — سطر 41

- **التوقيع:** `function debounce(fn, ms = 200)`
- **ماذا تفعل وكيف:** تحجز `timer` (42)؛ ترجع دالة سهمية تمسح المؤقت السابق `clearTimeout` (44) وتضبط `setTimeout(() => fn(...args), ms)` (45).
- **لماذا وُجدت:** تقليل إعادة رسم الفهرس أثناء الكتابة في `#search`.
- **المدخلات:** `fn` الدالة المؤجلة، `ms` المهلة (افتراضي 200).
- **المخرجات والتأثيرات:** ترجع دالة مؤجلة؛ لا DOM مباشر.
- **تناديها:** `bindEvents` (1163) للفّ `renderList`. **تنادي:** `fn` الممررة.

### `defaultState()` — سطر 53

- **التوقيع:** `function defaultState()`
- **ماذا تفعل وكيف:** ترجع كائنًا جديدًا `{read:{}, last:null, khatmaCount:0, dailyGoal:20, fontSize:1.9, log:{}, theme:null, lastExportAt:null}` (سطر 54) — كائن جديد كل استدعاء حتى لا تتشارك النسخ المرجع نفسه.
- **لماذا وُجدت:** مرجع واحد للقيم الافتراضية في `loadState` والتراجع عن الاستيراد، وأي حقل جديد يُضاف هنا أولًا.
- **المدخلات:** لا شيء. **المخرجات:** حالة فارغة صالحة.
- **تناديها:** `loadState` (60، 62)؛ `undoImport` (859). **تنادي:** لا شيء.

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
- **تناديها:** `refreshAyahUI` (139)؛ `resetKhatma` (362)؛ `checkKhatmaComplete` (974)؛ `toggleTheme` (925)؛ `changeFontSize` (932)؛ `bindEvents/setGoal` (1152)؛ `exportProgress` (609)؛ `applyImport` (833)؛ `undoImport` (860).

### `findSurah(number)` — سطر 72

- **التوقيع:** `function findSurah(number)`
- **ماذا تفعل وكيف:** `surahs.find((s) => s.number === number)` (سطر 73).
- **لماذا وُجدت:** جلب بيانات سورة من الفهرس برقمها في كل موضع يحتاج الاسم/العدد/النوع.
- **المدخلات:** `number` رقم السورة.
- **المخرجات:** كائن السورة أو `undefined`.
- **تناديها:** `updateSurahBadge` (148)؛ `openSurah` (275)؛ `completeCurrentSurah` (326)؛ `resetKhatma` (ضمنيًا)؛ `ayahsToRead` (516)؛ `parseProgressFile` (651، 668). **تنادي:** لا شيء.

### `getCachedAyahs(number)` — سطر 78

- **التوقيع:** `function getCachedAyahs(number)`
- **ماذا تفعل وكيف:** تحاول `JSON.parse(localStorage.getItem(CACHE_PREFIX + number))` (80) وترجع `cached?.ayahs` (81)؛ عند الفشل ترجع `null` (83).
- **لماذا وُجدت:** قراءة نص السورة المحفوظ بعد أول تحميل — الخطوة 1 من `loadSurahAyahs`.
- **المدخلات:** `number` رقم السورة.
- **المخرجات:** `[{number, text}]` أو `null`؛ تقرأ `localStorage` فقط.
- **تناديها:** `loadSurahAyahs` (217)؛ `completeCurrentSurah` (328 لحساب `total` دون شبكة).

### `saveSurahCache(number, ayahs)` — سطر 88

- **التوقيع:** `function saveSurahCache(number, ayahs)`
- **ماذا تفعل وكيف:** تكتب `{ayahs}` في `CACHE_PREFIX + number` (89) ثم تنادي `updateCacheBar()` (90) لتحديث نص زر الـ footer.
- **لماذا وُجدت:** حفظ النص بعد أول جلب ناجح ليعمل دون إنترنت + إبقاء عدّاد الزر حيًا.
- **المدخلات:** `number`، و`ayahs` مصفوفة `[{number, text}]`.
- **المخرجات والتأثيرات:** كتابة `localStorage` + تحديث DOM عبر `updateCacheBar`.
- **تناديها:** `loadSurahAyahs` (220 للـ offline، 227 للـ API). **تنادي:** `updateCacheBar`.

### `readTotal()` — سطر 94

- **التوقيع:** `function readTotal()`
- **ماذا تفعل وكيف:** `Object.keys(state.read).length` (سطر 95).
- **لماذا وُجدت:** إجمالي المقروء في الختمة الحالية — أساس النسبة والمتبقي وكشف الاكتمال.
- **المدخلات:** لا شيء. **المخرجات:** عدد صحيح.
- **تناديها:** `resetKhatma` (347)؛ `buildSummary` (538)؛ `renderStats` (943)؛ `checkKhatmaComplete` (970)؛ `showImportPreview` (783). **تنادي:** لا شيء.

### `readCountOf(surahNumber)` — سطر 99

- **التوقيع:** `function readCountOf(surahNumber)`
- **ماذا تفعل وكيف:** تبني بادئة `"N:"` (100) وترشّح مفاتيح `state.read` التي تبدأ بها ثم تعدّها (101).
- **لماذا وُجدت:** عدّاد كل سورة على حدة (شارة الفهرس + السور المكتملة في العدّاد والملخص + حساب غير المقروء في الإتمام).
- **المدخلات:** `surahNumber`. **المخرجات:** عدد آيات تلك السورة المقروءة.
- **تناديها:** `updateSurahBadge` (150)؛ `completedSurahCount` (157)؛ `renderList` (200)؛ `completeCurrentSurah` (330)؛ `buildSummary` (553). **تنادي:** لا شيء.

### `surahStatusText(meta, readCount)` — سطر 106

- **التوقيع:** `function surahStatusText(meta, readCount)`
- **ماذا تفعل وكيف:** تبني `["N آية", type]` (107)؛ إن `readCount >= ayahs` تدفع `'✔'` (108) وإلا إن `> 0` تدفع `"r/N"` (109)؛ تدمج بـ `' • '` (110).
- **لماذا وُجدت:** نص `<small>` الموحد في كل عنصر فهرس.
- **المدخلات:** `meta` بيانات السورة، `readCount`. **المخرجات:** نص عربي. لا تأثيرات.
- **تناديها:** `updateSurahBadge` (151)؛ `renderList` (206).

### `markAyahRead(surahNumber, ayahNumber, surahName)` — سطر 114

- **التوقيع:** `function markAyahRead(surahNumber, ayahNumber, surahName)`
- **ماذا تفعل وكيف:** تبني المفتاح `"S:A"` (115)؛ إن موجود ترجع فورًا (116 — تمنع تضخيم عدّاد اليوم)؛ وإلا تخزن `state.read[key] = todayKey()` (118) وتضبط `state.last` (119) وتزيد `state.log[today]` (120).
- **لماذا وُجدت:** التعليم الأحادي الاتجاه (يستخدمه النقر الثاني والحلقات الجماعية) — القيمة تاريخ نصي (truthy) لإنقاص عدّاد اليوم الصحيح عند التراجع.
- **المدخلات:** أرقام السورة والآية واسم السورة. **المخرجات:** لا شيء؛ تغيّر `state` في الذاكرة فقط (الحفظ على المتصل عبر `refreshAyahUI`).
- **تناديها:** `toggleAyahRead` (134)؛ `completeCurrentSurah` (339 في حلقة). **تنادي:** `todayKey`.

### `toggleAyahRead(surahNumber, ayahNumber, surahName)` — سطر 124

- **التوقيع:** `function toggleAyahRead(surahNumber, ayahNumber, surahName)`
- **ماذا تفعل وكيف:** إن المفتاح موجود: تقرأ يومه `day` (128)؛ إن كان نصًا و`state.log[day] > 0` تنقصه (129 — القيم القديمة `true` بلا يوم تُتجاهل عمدًا)؛ تحذف المفتاح (130)؛ وتصفّر `last` إن كانت هي نفس الآية (131) ثم ترجع (132)؛ وإلا تنادي `markAyahRead` (134).
- **لماذا وُجدت:** تبديل النقرة (تعليم ← تراجع) مع الحفاظ على سلامة عدّاد اليوم وآخر قراءة، ودعم بيانات `true` القديمة.
- **المدخلات/المخرجات:** كالسابقة؛ تغيّر `state` في الذاكرة فقط.
- **تناديها:** معالج `onclick` في `createAyahElement` (260). **تنادي:** `markAyahRead`.

### `refreshAyahUI(surahNumber)` — سطر 138

- **التوقيع:** `function refreshAyahUI(surahNumber)`
- **ماذا تفعل وكيف:** `saveState()` (139) ثم `renderStats()` (140) ثم `updateSurahBadge(surahNumber)` (141) ثم `updateSurahIndexCount()` (142).
- **لماذا وُجدت:** خط الأنابيب الموحد بعد كل تعليم/تراجع — حفظ + إحصاء + شارة السورة + عدّاد رأس الفهرس، دون إعادة رسم القائمة كاملة (أداء).
- **تناديها:** معالج النقر في `createAyahElement` (261)؛ `completeCurrentSurah` (341). **تنادي:** الأربعة المذكورة.

### `updateSurahBadge(surahNumber)` — سطر 146

- **التوقيع:** `function updateSurahBadge(surahNumber)`
- **ماذا تفعل وكيف:** تجد زر الفهرس `[data-surah="N"]` (147) و`meta` (148)؛ إن غاب أحدهما ترجع (149)؛ تحسب `readCountOf` (150) وتحدّث `<small>` عبر `surahStatusText` (151) وتبدّل صنف `done` (152).
- **لماذا وُجدت:** تحديث شارة سورة واحدة فقط — تجنّب `renderList` الكاملة عند كل نقرة.
- **التأثيرات:** تعديل DOM موضعي فقط.
- **تناديها:** `refreshAyahUI` (141). **تنادي:** `findSurah`، `readCountOf`، `surahStatusText`.

### `completedSurahCount()` — سطر 156

- **التوقيع:** `function completedSurahCount()`
- **ماذا تفعل وكيف:** سطر واحد: `surahs.reduce` تعدّ السور حيث `readCountOf(meta.number) >= meta.ayahs` (157).
- **لماذا وُجدت:** مصدر عدّاد رأس الفهرس «X / 114 سورة» — السورة المكتملة كل آياتها مقروءة. الحساب الكامل في كل استدعاء (114 تكرارًا رخيصًا) أبسط وأكثر أمانًا من تتبع تدريجي قد ينحرف.
- **المدخلات:** لا شيء (تقرأ `surahs` و`state.read` عبر `readCountOf`). **المخرجات:** عدد صحيح.
- **تناديها:** `updateSurahIndexCount` (164). **تنادي:** `readCountOf`.

### `updateSurahIndexCount()` — سطر 161

- **التوقيع:** `function updateSurahIndexCount()`
- **ماذا تفعل وكيف:** تجد `#surahCount` (162) وترجع إن غاب (163)؛ تكتب `${completedSurahCount()} / ${surahs.length || 114} سورة` (164).
- **لماذا وُجدت:** عدّاد رأس الفهرس حيًّا مع كل تغيير — بدل «114 سورة» الثابتة القديمة. الحدّ الاحتياطي `114` يظهر قبل تحميل الفهرس.
- **التأثيرات:** كتابة DOM موضعي (`#surahCount` فقط).
- **تناديها:** `refreshAyahUI` (142)؛ `renderList` (212). **تنادي:** `completedSurahCount`.

### `normalizeArabic(s)` — سطر 168

- **التوقيع:** `function normalizeArabic(s)`
- **ماذا تفعل وكيف:** سلسلة `replace`: همزات `[أإآ]` ← `ا`، `ة` ← `ه`، `ى` ← `ي`، حذف التشكيل `[ً-ٟ]` (سطر 169).
- **لماذا وُجدت:** ليجد «ابراهيم» سورة «إبراهيم» — مطابقة متسامحة.
- **تناديها:** `surahMatches` (186). **تنادي:** لا شيء.

### `normalizeDigits(s)` — سطر 173

- **التوقيع:** `function normalizeDigits(s)`
- **ماذا تفعل وكيف:** تحوّل المشرقية `[٠-٩]` والفارسية `[۰-۹]` إلى لاتينية عبر `indexOf` (174)؛ تجرّد المسافات `trim` (175) والأصفار البادئة `^0+` (176).
- **لماذا وُجدت:** ليجد «٠١٨» أو « 18 » السورة 18.
- **تناديها:** `surahMatches` (183). **تنادي:** لا شيء.

### `surahMatches(meta, query)` — سطر 180

- **التوقيع:** `function surahMatches(meta, query)`
- **ماذا تفعل وكيف:** إن لا استعلام ترجع `true` (181)؛ تحسب `q` الصغيرة (182) و`nq` المطبّعة رقميًا (183) و`isNumeric` (184)؛ ترجع OR: عربي مطبّع `includes` (186) أو إنجليزي `includes` غير حساس (187) أو رقم مطابق تمامًا `String(number) === nq` (188).
- **لماذا وُجدت:** منطق المطابقة الثلاثي (عربي/إنجليزي/رقم) للبحث الجانبي.
- **تناديها:** `renderList` (199). **تنادي:** `normalizeArabic`، `normalizeDigits`.

### `renderList(filter = '')` — سطر 193

- **التوقيع:** `function renderList(filter = '')`
- **ماذا تفعل وكيف:** تجد `#surahList` وتفرّغه (194-195)؛ تقصّ الفلتر (196)؛ تنشئ `DocumentFragment` (197)؛ ترشّح بـ `surahMatches` (199) ولكل سورة: تحسب المقروء و`done` (200-201)، تنشئ `<button data-surah>` بأصناف `surah-item/active/done` (202-205)، تحشو `innerHTML` (رقم + `سورة name` + `<small>` الحالة + ✔) (206)، تربط `onclick → openSurah` (207) وتلحق بـ fragment (208)؛ تلحق الكل دفعة واحدة (211)؛ ثم تنادي `updateSurahIndexCount()` (212) ليصحّ العدّاد بعد كل رسم (فلترة/استيراد/تصفير).
- **لماذا وُجدت:** رسم الفهرس دفعة واحدة لتقليل إعادة التدفق (أداء).
- **التأثيرات:** إعادة بناء `#surahList` كاملة + تحديث `#surahCount`.
- **تناديها:** `bindEvents` عبر البحث (1163)؛ `resetKhatma` (365)؛ `checkKhatmaComplete` (975)؛ `refreshAfterImport` (772)؛ `init` (1241). **تنادي:** `surahMatches`، `readCountOf`، `surahStatusText`، `updateSurahIndexCount`، `openSurah` (عبر النقر).

### `loadSurahAyahs(number)` — سطر 216

- **التوقيع:** `async function loadSurahAyahs(number)`
- **ماذا تفعل وكيف:** (1) كاش → ترجعه (217-218)؛ (2) `OFFLINE_SURAHS[number]` → يحفظه `saveSurahCache` ويرجعه (219-222)؛ (3) `fetch(api.alquran.cloud/v1/surah/N/quran-uthmani)` (223)؛ إن `!ok` يرمي (224)؛ يحوّل `json.data.ayahs` إلى `[{number: numberInSurah, text}]` (226) ويحفظه (227) ويرجعه (228).
- **لماذا وُجدت:** ترتيب المصادر الثابت: محلي أولًا ثم مضمّن ثم الرسمي (طبعة `quran-uthmani` لا تُغيَّر دون طلب).
- **تناديها:** `openSurah` (288). **تنادي:** `getCachedAyahs`، `saveSurahCache`، `fetch`.

### `stripBasmalaPrefix(text)` — سطر 233

- **التوقيع:** `function stripBasmalaPrefix(text)`
- **ماذا تفعل وكيف:** تقسّم كلمات (234)؛ تأخذ أول 4 كلمات وتطبّعها (`ٱ`←`ا` وحذف التشكيل) (235)؛ إن طابقت `بسم الله الرحمن الرحيم` ترجع الباقي (237) وإلا الأصل (238).
- **لماذا وُجدت:** الـ API يُبقي البسملة في الآية 1 والعرض يضع بسملة خضراء زخرفية — التجريد يمنع التكرار. نسخة عرض فقط، الكاش لا يُمس. تُستخدم للسور عدا 1 و9.
- **تناديها:** `openSurah` (308).

### `highlightActiveSurah(number)` — سطر 241

- **التوقيع:** `function highlightActiveSurah(number)`
- **ماذا تفعل وكيف:** تزيل `active` عن الكل (242) وتضيفها لـ `[data-surah="N"]` مع `?.` الآمن (243).
- **لماذا وُجدت:** إبراز السورة المفتوحة في الفهرس.
- **تناديها:** `openSurah` (280).

### `createAyahElement(surahNumber, surahName, ayah)` — سطر 247

- **التوقيع:** `function createAyahElement(surahNumber, surahName, ayah)`
- **ماذا تفعل وكيف:** تبني المفتاح (248) وتحسب `isLast` (249)؛ تنشئ `<span.ayah>` بأصناف `read` و`last` (الثانية فقط إن مقروءة أيضًا) (251) و`id=ayah-N` (252) ونص الآية (253)؛ تلحق حبة الرقم `.ayah-num` (254-257) ومسافة (258)؛ تربط `onclick`: تبديل + `refreshAyahUI` + تبديل صنف `read` محليًا (260-262) + نقل صنف `last` للآية الأخيرة الحالية (263-266) + فحص الاكتمال (267)؛ ترجع العنصر (269).
- **لماذا وُجدت:** تغليف كل آية كعنصر نقّار يحدّث نفسه دون إعادة رسم السورة.
- **التأثيرات:** إنشاء DOM + ربط حدث؛ عند النقر: `localStorage` (عبر `refreshAyahUI`) وتعديل أصناف.
- **تناديها:** `openSurah` (312). **تنادي:** `toggleAyahRead`، `refreshAyahUI`، `checkKhatmaComplete`.

### `openSurah(number, scrollToAyah = null)` — سطر 273

- **التوقيع:** `async function openSurah(number, scrollToAyah = null)`
- **ماذا تفعل وكيف:** تضبط `currentSurah` (274)؛ تجد `meta` وترجع إن غابت (275-276)؛ ترسم العنوان `#surahTitle` والوصف `#surahMeta` (277-278) و`جاري التحميل…` (279)؛ تبرز الفهرس (280)؛ تُخرج السورة من طابور الخلفي `dequeue` وتوقفه `userActive(true)` (282-283)؛ تفعّل زر الإتمام (284-285)؛ تجلب `loadSurahAyahs` (288) — عند الفشل: تستأنف الخلفي `userActive(false)` (290)، حارس السباق `currentSurah !== number` (291)، رسالة الخطأ الثابتة عن السور المحفوظة (292)؛ تستأنف الخلفي (295) وحارس السباق الثاني (296)؛ تفرّغ `#reader` وتبني `Fragment` (298-300)؛ بسملة زخرفية لكل السور عدا 1 و9 (301-305) + تجريد بسملة الآية 1 للعرض فقط (307-310)؛ تلحق الآيات عبر `createAyahElement` (312-313)؛ إن `scrollToAyah` تمرّر إليه بسلاسة بعد 100ms (315-319).
- **لماذا وُجدت:** الدالة المحورية لعرض سورة: عنوان + نص عثماني قابل للتعليم + تنسيق بسملة + تكامل مع التحميل الخلفي وحماية السباق.
- **المدخلات:** رقم السورة وآية اختيارية للتمرير (زر المتابعة).
- **التأثيرات:** قراءة DOM وكتابته (`#surahTitle`، `#surahMeta`، `#reader`)؛ قراءة `localStorage`/شبكة (عبر `loadSurahAyahs`)؛ إشارات لـ `window.SurahPreloader`.
- **تناديها:** نقرات الفهرس (207)؛ أزرار `data-goto` (1165)؛ المتابعة (1168-1169)؛ السابق/التالي (1194، 1197)؛ `completeCurrentSurah` (342)؛ `resetKhatma` (366)؛ `checkKhatmaComplete` (977)؛ `refreshAfterImport` (775). **تنادي:** `findSurah`، `highlightActiveSurah`، `loadSurahAyahs`، `stripBasmalaPrefix`، `createAyahElement`، `SurahPreloader.dequeue/userActive`.

### `completeCurrentSurah()` — سطر 324

- **التوقيع:** `async function completeCurrentSurah()`
- **ماذا تفعل وكيف:** ترجع إن لا سورة مفتوحة أو `meta` غائبة (325-327)؛ تقرأ الكاش لحساب `total` (احتياطي `meta.ayahs`) (328-329)؛ تحسب `unread = total - readCountOf` وترجع إن صفر (330-331)؛ تقرأ عدّاد اليوم (332)؛ تعرض `showModal` بعدد غير المقروء وأثره على الورد `اليوم: X ← X+unread` (333-337)؛ إن رفض ترجع (338)؛ تعلّم 1..total بحلقة `markAyahRead` (339) وتضبط `last` على آخر آية (340)؛ `refreshAyahUI` (341)؛ إن لم تكتمل الختمة تعيد `openSurah` (342 — عند الاكتمال يترك الرسم لـ `checkKhatmaComplete`).
- **لماذا وُجدت:** إتمام السورة دفعة واحدة بتأكيد يعرض الأثر — مع حماية (لا شيء دون سورة/دون جديد، زر `disabled` حتى تُفتح سورة في `index.html:156`).
- **التأثيرات:** `state` + حفظ + إحصاء + عدّاد الفهرس + إعادة رسم القارئ؛ نافذة تأكيد.
- **تناديها:** زر `#completeSurahBtn` (1192). **تنادي:** `findSurah`، `getCachedAyahs`، `readCountOf`، `todayKey`، `showModal`، `markAyahRead`، `refreshAyahUI`، `checkKhatmaComplete`، `openSurah`.

### `resetKhatma()` — سطر 346

- **التوقيع:** `async function resetKhatma()`
- **ماذا تفعل وكيف:** تحسب `total` و`missing` (347-348)؛ تعرض `showModal` خطرًا أحمر (`danger:true`) بالنص الصريح `قرأت N — ينقصك M` + صندوق إقرار `أحتسبها… — أقر بأنني واعٍ` فقط عندما `0 < total < TOTAL_AYAS` (349-355)؛ تفكّ النتيجة `{ok, checked}` (356-357) وترجع إن رفض (358)؛ إن `checked` تزيد `khatmaCount` (359)؛ تصفّر `read` و`last` (360-361) وتحفظ (362)؛ تفرّغ البحث وتعيد رسم القائمة والإحصاء (363-365)؛ تعيد فتح الحالية إن وُجدت (366).
- **لماذا وُجدت:** تصفير الختمة لبدء جديدة — احتساب المكتملة يتطلب تعليمًا صريحًا غير معلَّم افتراضيًا، وإلا تصفير دون احتساب.
- **التأثيرات:** `localStorage` + `#search` + `#surahList` + عدّاد الفهرس + الإحصاء + `#reader`.
- **تناديها:** زر `#resetBtn` (1171). **تنادي:** `readTotal`، `showModal`، `saveState`، `renderList`، `renderStats`، `openSurah`.

### قسم نقل التقدم — سطر 369

قسم مستقل بين `resetKhatma` و`=== الوضع الليلي` (369-902): ملف JSON محلي بلا شبكة. الثوابت: `PROGRESS_FORMAT = 2` (372) و`APP_VERSION` (374) و`PROGRESS_MAX_BYTES` (375) و`SOURCE_LABELS` (377)، والمتغيران `pendingImportMode` (378) و`undoTimer` (379).

| الدالة | السطر | ماذا تفعل |
|---|---|---|
| `isDayString` | 382 | تتحقق من `YYYY-MM-DD` حقيقي (ترفض 2026-02-31) |
| `isFutureDay` | 389 | ترفض ما بعد الغد (الغد نفسه مقبول حاليًا) |
| `daysAgoText` | 396 | صياغة «قبل يوم/يومين/N يومًا» |
| `renderTransferStatus` | 408 | تكتب سطر «آخر نسخة» من `state.lastExportAt` |
| `localStamp` | 417 | طابع محلي `YYYY-MM-DD HH:mm:ss` بساعة 24 |
| `timezoneInfo` | 422 | `{iana, offset}` مثل `Asia/Riyadh` و`+03:00` |
| `detectSource` | 434 | `localhost` / `apk` / `pwa` / `web` مع `origin` |
| `detectDevice` | 444 | وصف الجهاز من UA: `label/platform/model/browser/language` |
| `readToAyahs` | 487 | يحوّل خريطة `read` إلى قائمة `ayahs` مرتبة |
| `ayahsToRead` | 499 | يتحقق من `ayahs` v2 ويبني خريطة `read` — أو يرفض |
| `buildSummary` | 537 | ملخص وصفي: نسبة/متبقٍ/سلسلة أيام/ورد اليوم |
| `collectProgress` | 570 | يبني ملف v2 كاملًا (غلاف + وصف + `state` بلا `read`) |
| `exportProgress` | 596 | ينزّل `noor-progress-YYYY-MM-DD-HHmmss.json` ويحدّث `lastExportAt` |
| `parseProgressFile` | 615 | تحقق كامل (v2/v1، سقف، فهرس، تواريخ، إعدادات) قبل أي أثر |
| `describeImportMeta` | 718 | سطر «الملف من … — أُنشئ …» للمعاينة |
| `sanitizeLog` | 730 | تُبقي تواريخ وأعدادًا صالحة فقط |
| `mergeRead` | 742 | اتحاد الآيات بأقدم تاريخ (و`true` تُستبدل بتاريخ) |
| `mergeLog` | 754 | إعادة حساب الأيام من تواريخ `read` ثم `max` مع المحفوظ — بلا تضاعف |
| `refreshAfterImport` | 768 | إعادة رسم الهدف/الخط/الثيم/الفهرس/الإحصاء/القارئ |
| `showImportPreview` | 780 | معاينة عبر `showModal` (استبدال = danger) ثم `applyImport` |
| `applyImport` | 805 | نسخة أمان في `BACKUP_KEY` (830) ثم دمج/استبدال وزر تراجع 10 ثوانٍ |
| `undoImport` | 847 | تستعيد `backup.state` (859) وتحذف النسخة |
| `pickImportFile` | 869 | تفتح `#importFile` بالوضع المختار |
| `handleImportFile` | 878 | سقف الحجم، قراءة، `parseProgressFile`، ثم المعاينة |

**v2 مقابل v1:** ملف v2 يحمل `state.ayahs` (قائمة مرتبة) **لا `read`**؛ و`read` يبقى شكل `localStorage` فقط. الاستيراد يقبل v2 وv1 ويرفض `version > 2`.

#### `isDayString(value)` — سطر 382

- **التوقيع:** `function isDayString(value)`
- **ماذا تفعل وكيف:** ترفض غير النص أو ما لا يطابق `^\d{4}-\d{2}-\d{2}$` (383)؛ تفكّ السنة/الشهر/اليوم (384) وتبني `new Date(year, month-1, day)` (385)؛ تتحقق أن المكوّنات عادت كما هي (386) — لذلك تُرفض `2026-02-31`.
- **لماذا وُجدت:** التحقق من كل تاريخ في الملف (آية/سجل/مستقبلي) دون الاعتماد على `Date.parse` المتسامح.
- **المدخلات:** أي قيمة. **المخرجات:** `boolean`.
- **تناديها:** `ayahsToRead` (529)؛ `parseProgressFile` (660)؛ `sanitizeLog` (734).

#### `isFutureDay(value)` — سطر 389

- **التوقيع:** `function isFutureDay(value)`
- **ماذا تفعل وكيف:** تبني `tomorrow` من اليوم +1 (390-391) وتقارن نصيًا `value > dateKeyOf(tomorrow)` (392) — أي أن **الغد نفسه مقبول** (لأنه ليس أكبر من مفتاح الغد)، وما بعده مرفوض؛ اليوم والأمس وما قبلهما مقبولان. هذا سلوك الدالة الحالي كما هو.
- **لماذا وُجدت:** منع تواريخ مستقبلية في ملف مستورد (عبث أو ساعة جهاز خاطئة).
- **المدخلات:** نص `YYYY-MM-DD` صالح. **المخرجات:** `boolean`.
- **تناديها:** `ayahsToRead` (530)؛ `parseProgressFile` (661)؛ `sanitizeLog` (734). **تنادي:** `dateKeyOf`.

#### `daysAgoText(iso)` — سطر 396

- **التوقيع:** `function daysAgoText(iso)`
- **ماذا تفعل وكيف:** تحوّل ISO إلى `Date` (397) وترجع `''` إن غير صالح (398)؛ تحسب الأيام `floor((Date.now() - then) / 86400000)` (399)؛ صياغة عربية: `اليوم` (400)، `قبل يوم واحد` (401)، `قبل يومين` (402)، `قبل N أيام` حتى 10 (403)، ثم `قبل N يومًا` (404).
- **لماذا وُجدت:** سطر «آخر نسخة» الودّي بدل تاريخ خام.
- **المدخلات:** نص ISO. **المخرجات:** نص عربي أو `''`.
- **تناديها:** `renderTransferStatus` (412).

#### `renderTransferStatus()` — سطر 408

- **التوقيع:** `function renderTransferStatus()`
- **ماذا تفعل وكيف:** تجد `#lastExportLine` وترجع إن غاب (409-410)؛ إن `state.lastExportAt` تكتب `آخر نسخة: <daysAgoText>.` (411-412) وإلا رسالة «لم تصدّر نسخة بعد…» (413).
- **لماذا وُجدت:** تذكير دائم بأهمية النسخة الاحتياطية، ومنع تغييره بالاستيراد (المصدر `state.lastExportAt` فقط).
- **التأثيرات:** كتابة DOM فقط.
- **تناديها:** `exportProgress` (610)؛ `refreshAfterImport` (774)؛ `init` (1246).

#### `localStamp(date)` — سطر 417

- **التوقيع:** `function localStamp(date)`
- **ماذا تفعل وكيف:** ترجع `${dateKeyOf(date)} ${pad2(getHours())}:${pad2(getMinutes())}:${pad2(getSeconds())}` (418) — ساعة 24 من `getHours` (0-23) بلا AM/PM.
- **لماذا وُجدت:** `exportedAtLocal` مقروء للبشر في الغلاف، واسم الملف المبني عليه.
- **المدخلات:** `Date`. **المخرجات:** `YYYY-MM-DD HH:mm:ss` بالتوقيت المحلي.
- **تناديها:** `collectProgress` (578). **تنادي:** `dateKeyOf`، `pad2`.

#### `timezoneInfo()` — سطر 422

- **التوقيع:** `function timezoneInfo()`
- **ماذا تفعل وكيف:** تقرأ اسم المنطقة من `Intl.DateTimeFormat().resolvedOptions().timeZone` مع `UTC` احتياطيًا (423-426)؛ تحسب الدقائق `total = -getTimezoneOffset()` (427، موجب شرق غرينتش)؛ تحدد الإشارة `-` أو `+` (428)؛ ترجع `{iana, offset}` بصيغة `+03:00` / `-04:30` / `+00:00` (429-430).
- **لماذا وُجدت:** تحديد توقيت الجهاز الذي أُنشئ فيه الملف — وصفي فقط.
- **المدخلات:** لا شيء. **المخرجات:** `{iana: string, offset: string}`.
- **تناديها:** `collectProgress` (579). **تنادي:** `pad2`.

#### `detectSource()` — سطر 434

- **التوقيع:** `function detectSource()`
- **ماذا تفعل وكيف:** تقرأ `location.origin` و`hostname` (435-436)؛ بالترتيب: `localhost/127.0.0.1/::1/[::1]` → `localhost` (437)؛ referrer يبدأ `android-app://` أو `window.Capacitor?.isNativePlatform?.()` → `apk` (438)؛ `display-mode: standalone` أو `navigator.standalone === true` → `pwa` (439)؛ وإلا `web` (440). كل الحالات ترجع `{kind, origin}`.
- **لماذا وُجدت:** تمييز بيئة التشغيل (ويب/مثبت/APK/محلي) في الغلاف الوصفي — لا يقرأ ولا يغيّر الحالة.
- **المدخلات:** لا شيء. **المخرجات:** `{kind: 'localhost'|'apk'|'pwa'|'web', origin: string}`.
- **تناديها:** `collectProgress` (580).

#### `detectDevice()` — سطر 444

- **التوقيع:** `function detectDevice()`
- **ماذا تفعل وكيف:** تقرأ `navigator.userAgent` و`navigator.language` (445-446)؛ تحدد المنصة بالترتيب: أندرويد مع إصدار (450-452)، iPhone (453)، iPad (454)، Windows (455)، macOS (456)، Linux (457) — وإلا `Unknown`. تستخرج الطراز من نمط أندرويد القياسي «Android …; <MODEL> Build/» وتستبعد `wv` (460-464). تحدد المتصفح بالترتيب Edge → Opera → Chrome → Firefox → Safari لتفادي تداخل الـ UA (467-479). `label` = «الطراز • المنصة» إن وُجد طراز، وإلا «المنصة • المتصفح» (481). ترجع `{label, platform, model, browser, language}` (482).
- **لماذا وُجدت:** وصف مقروء للجهاز في معاينة الاستيراد — مشتق من UA فقط بلا مكتبات كشف، ولا يدخل الحالة.
- **المدخلات:** لا شيء. **المخرجات:** كائن الجهاز أعلاه.
- **تناديها:** `collectProgress` (581).

#### `readToAyahs(read)` — سطر 487

- **التوقيع:** `function readToAyahs(read)`
- **ماذا تفعل وكيف:** تأخذ مفاتيح الخريطة (488) وتفكّها إلى `surah/ayah` بأرقام (490)؛ القيمة النصية تصبح `{surah, ayah, date}` (492) والقيمة القديمة `true` تصبح `{surah, ayah, date: null, legacy: true}` (492)؛ تفلتر غير الصحيح (494)؛ ترتب بالسورة ثم الآية (495).
- **لماذا وُجدت:** تحويل `state.read` الداخلي (خريطة) إلى `state.ayahs` (قائمة مرتبة) في ملف v2 — المرجع في الملف، مع إبقاء `true` واضحة.
- **المدخلات:** خريطة `read`. **المخرجات:** `Array<{surah, ayah, date, legacy?}>` مرتبة.
- **تناديها:** `collectProgress` (584).

#### `ayahsToRead(ayahs)` — سطر 499

- **التوقيع:** `function ayahsToRead(ayahs)`
- **ماذا تفعل وكيف:** ترفض غير المصفوفة (500) وتجاوز 6236 (501-503)؛ لكل عنصر: كائن غير مصفوفة (507-509)، `surah/ayah` أعداد صحيحة حقيقية بأنواع `number` (511-513)، داخل الفهرس (`meta` و`1 ≤ ayah ≤ meta.ayahs`) (516-519)، لا تكرار للمفتاح (520-522)؛ `date` غائب أو `null` → `true` (524-526)، وإلا نص صالح لا يتجاوز الغد (528-531). أي خطأ يرجع `{ok:false, error}` بلا أثر على الحالة.
- **لماذا وُجدت:** التحقق الصارم لصيغة v2 قبل بناء `read` — ترفض الملف كاملًا عند أول خطأ.
- **المدخلات:** `state.ayahs` من الملف. **المخرجات:** `{ok:true, read}` أو `{ok:false, error}`.
- **تناديها:** `parseProgressFile` (635). **تنادي:** `findSurah`، `isDayString`، `isFutureDay`، `TOTAL_AYAS`.

#### `buildSummary()` — سطر 537

- **التوقيع:** `function buildSummary()`
- **ماذا تفعل وكيف:** تحسب `total` (538) و`today` (539) و`count` من `log` (540) و`goal` (541)؛ تجمع أيام `log` الموجبة وترتبها (542)؛ تحسب `streakDays` من اليوم إن كان فيه قراءة وإلا من الأمس ثم للخلف (545-551)؛ تعدّ `completedSurahs` حيث `readCountOf === meta.ayahs` (553)؛ ترجع `{readCount, totalAyahs, percent, remaining, khatmaCount, completedSurahs, activeDays, streakDays, firstReadDate, today:{date,count,goal,remaining,met}}` (554-565). `percent = Math.round((total/6236)*10000)/100` (557).
- **لماذا وُجدت:** ملخص وصفي لحظي يوضع في الملف ليسهل فهم النسخة بشرًا — **لا يُستورد إلى الحالة**.
- **المدخلات:** لا شيء (تقرأ `state` و`surahs`). **المخرجات:** كائن `summary`.
- **تناديها:** `collectProgress` (582).

#### `collectProgress()` — سطر 570

- **التوقيع:** `function collectProgress()`
- **ماذا تفعل وكيف:** تأخذ `now` (571)؛ تبني الغلاف صراحةً بلا spread: `app:'noor'`، `kind:'progress'`، `version:2`، `appVersion`، `exportedAt: now.toISOString()`، `exportedAtLocal: localStamp(now)`، `timezone`، `source`، `device`، `summary` (572-582)؛ ثم `state` بالحقول: `ayahs: readToAyahs(state.read)`، `last`، `khatmaCount`، `dailyGoal`، `fontSize`، `theme`، `log` (583-591) — **بلا `read`**.
- **لماذا وُجدت:** عزل بناء الملف عن شكل الحالة الداخلي، وعدم تسريب حقول غير موثوقة.
- **المدخلات:** لا شيء. **المخرجات:** كائن ملف v2 كامل.
- **تناديها:** `exportProgress` (597). **تنادي:** `localStamp`، `timezoneInfo`، `detectSource`، `detectDevice`، `buildSummary`، `readToAyahs`.

#### `exportProgress()` — سطر 596

- **التوقيع:** `function exportProgress()`
- **ماذا تفعل وكيف:** تبني `payload` (597)؛ تنشئ `Blob` من `JSON.stringify(payload, null, 2)` بنوع `application/json` (598)؛ تنشئ رابط تنزيل مؤقت (599-606)؛ اسم الملف `noor-progress-${exportedAtLocal.replace(' ', '-').replace(/:/g, '')}.json` أي `noor-progress-YYYY-MM-DD-HHmmss.json` (603)؛ تحرر الـ URL بعد ثانيتين (607)؛ تحدّث `state.lastExportAt = payload.exportedAt` وتحفظ وتعيد رسم سطر «آخر نسخة» (608-610)؛ تكتب رسالة البدء في `#transferStatus` (611).
- **لماذا وُجدت:** تصدير نسخة كاملة تعمل على الجوال وسطح المكتب بلا شبكة.
- **التأثيرات:** تنزيل ملف + كتابة `localStorage` + DOM.
- **تناديها:** زر `#exportBtn` (1174).

#### `parseProgressFile(text)` — سطر 615

- **التوقيع:** `function parseProgressFile(text)`
- **ماذا تفعل وكيف:** `JSON.parse` داخل try (617-621)؛ ترفض غير الكائن/المصفوفة (622-624)؛ تختار `src = root.state` إن كان كائنًا وإلا `root` (626)؛ ترفض `version > 2` (627-629)؛ تستخدم `src.ayahs` إن كانت مصفوفة وإلا `root.ayahs` إن كانت مصفوفة (632)؛ إن وُجدت تمررها إلى `ayahsToRead` (634-637)، وإلا تقبل `read` بصيغة v1: كائن غير مصفوفة (640-642)، ≤6236 (643-646)، مفتاح `^\d{1,3}:\d{1,3}$` (649-650)، داخل الفهرس (651-655)، `true` مقبولة (656-658)، وتاريخ صالح لا يتجاوز الغد (660-662). ثم `last` يُتحقق ويعاد بناؤه باسم السورة (666-674)؛ تقيّد `dailyGoal` 1-500 و`fontSize` 1.2-3 و`theme` و`khatmaCount` و`log` (676-710)؛ تحلل `exportedAt` (679، 711). تبني `meta` للعرض فقط بنصوص مقصوصة ونوع مصدر مسموح: `version/appVersion/exportedAt/exportedAtLocal/source/device` (681-699).
- **لماذا وُجدت:** التحقق الكامل قبل أي لمس للحالة — الملف يُرفض كاملًا عند أول خطأ، والوصفي لا يدخل `incoming`.
- **المدخلات:** نص الملف. **المخرجات:** `{ok:true, incoming, meta}` أو `{ok:false, error}`.
- **تناديها:** `handleImportFile` (896). **تنادي:** `ayahsToRead`، `findSurah`، `isDayString`، `isFutureDay`، `sanitizeLog`، `SOURCE_LABELS`، `PROGRESS_FORMAT`، `TOTAL_AYAS`.

#### `describeImportMeta(meta)` — سطر 718

- **التوقيع:** `function describeImportMeta(meta)`
- **ماذا تفعل وكيف:** ترجع `''` إن لا `meta` (719)؛ تترجم `source.kind` عبر `SOURCE_LABELS` (720)؛ تأخذ `device.label` (721)؛ تبني `from` = «الجهاز (النوع)» أو النوع فقط (722)؛ تجمع «الملف من: …» و«أُنشئ: …» بفاصل `—` وتحذف الغائب (723-725)؛ ترجع السطر منتهيًا بنقطة ومسافة أو `''` (726).
- **لماذا وُجدت:** سطر وصفي أول معاينة الاستيراد يخبر المستخدم مصدر الملف وتاريخه قبل التأكيد — لا يدخل الحالة.
- **المدخلات:** `meta` من `parseProgressFile`. **المخرجات:** نص عربي أو `''`.
- **تناديها:** `showImportPreview` (788). **تنادي:** `SOURCE_LABELS`.

#### `sanitizeLog(raw)` — سطر 730

- **التوقيع:** `function sanitizeLog(raw)`
- **ماذا تفعل وكيف:** ترجع `{}` إن لم يكن كائنًا غير مصفوفة (731-732)؛ تمر على كل يوم: تقبل تاريخًا صالحًا لا يتجاوز الغد فقط (734) وعددًا صحيحًا `0..6236` (735-736)؛ تجمع النظيف (737).
- **لماذا وُجدت:** سجل الأيام في الملف قد يكون معطوبًا — نُبقي الصالح فقط ثم يعاد الحساب في `mergeLog`.
- **المدخلات:** `log` من الملف. **المخرجات:** كائن سجل نظيف.
- **تناديها:** `parseProgressFile` (710). **تنادي:** `isDayString`، `isFutureDay`، `TOTAL_AYAS`.

#### `mergeRead(localRead, incomingRead)` — سطر 742

- **التوقيع:** `function mergeRead(localRead, incomingRead)`
- **ماذا تفعل وكيف:** تبدأ بنسخة من المحلي (743)؛ لكل مفتاح وارد: إن غاب يُضاف (746)؛ إن كانت القيمة الحالية غير نصية والواردة نصية تُستبدل (747 — `true` القديمة تُستبدل بأي تاريخ)؛ إن كانتا نصيتين والواردة أقدم تُستبدل (748).
- **لماذا وُجدت:** اتحاد آمن للآيات يحفظ أقدم تاريخ تعليم (لا يضاعف العدّ ولا يقدّم التاريخ).
- **المدخلات:** خريطتا `read`. **المخرجات:** خريطة مدموجة.
- **تناديها:** `applyImport` (808).

#### `mergeLog(localLog, importedLog, read)` — سطر 754

- **التوقيع:** `function mergeLog(localLog, importedLog, read)`
- **ماذا تفعل وكيف:** تعيد حساب الأيام من قيم `read` النصية فقط (755-758)؛ تجمع مفاتيح المحلي والمستورد والمحسوب (759)؛ لكل يوم تأخذ `Math.max` للثلاثة (761-763) — فلا ينقص سجل سابق ولا يتضاعف.
- **لماذا وُجدت:** توحيد سجل الأيام بعد الدمج/الاستبدال من مصدر الحقيقة (`read`) مع الحفاظ على تاريخ الختمات الماضية.
- **المدخلات:** `localLog`، `importedLog`، خريطة `read` النهائية. **المخرجات:** سجل مدموج.
- **تناديها:** `applyImport` (813، 824).

#### `refreshAfterImport()` — سطر 768

- **التوقيع:** `function refreshAfterImport()`
- **ماذا تفعل وكيف:** تنادي بالترتيب: `applyGoalUI`، `applyReaderFontSize`، `applyTheme`، `renderList`، `renderStats`، `renderTransferStatus`، ثم `openSurah(currentSurah)` إن كانت هناك سورة مفتوحة (769-775).
- **لماذا وُجدت:** كل ما يعتمد على الحالة يجب أن يعاد رسمه بعد الاستيراد/التراجع — لا يكفي حفظ الحالة. `renderList` يحدّث عدّاد الفهرس تلقائيًا (سطر 212).
- **التأثيرات:** DOM + إعادة رسم القارئ.
- **تناديها:** `applyImport` (834)؛ `undoImport` (864).

#### `showImportPreview(incoming, mode, meta = null)` — سطر 780

- **التوقيع:** `async function showImportPreview(incoming, mode, meta = null)`
- **ماذا تفعل وكيف:** تحسب `total` ونسبته `toFixed(2)` و`localTotal` و`added` (781-784)؛ تبني `lastLine` حسب وجود `last` (785-787) و`metaLine` من `describeImportMeta` (788)؛ نص الاستبدال يذكر الحجم الحالي والإعدادات وموضع التوقف، ونص الدمج يذكر عدد الآيات المضافة (789-793)؛ تعرض `showModal` بعنوان مناسب و`danger` في الاستبدال (794-799)؛ إن تأكد تنادي `applyImport` (800-801).
- **لماذا وُجدت:** معاينة الأثر قبل التطبيق — الاستبدال خطر لا يُلغى بالنقر خارج البطاقة.
- **المدخلات:** `incoming` و`mode` و`meta`. **المخرجات:** لا شيء؛ نافذة ثم تطبيق.
- **تناديها:** `handleImportFile` (901). **تنادي:** `readTotal`، `describeImportMeta`، `showModal`، `applyImport`.

#### `applyImport(incoming, mode)` — سطر 805

- **التوقيع:** `function applyImport(incoming, mode)`
- **ماذا تفعل وكيف:** تنسخ الحالة السابقة عميقًا (806)؛ `replace = mode === 'replace'` (807)؛ تحسب `mergedRead` (808)؛ تبني `next`: في الاستبدال `read` من الملف و`log = mergeLog({}, incoming.log, incoming.read)` و`khatmaCount/last/dailyGoal/fontSize/theme` من الملف و`lastExportAt = incoming.exportedAt` (810-820)؛ في الدمج `read = mergedRead` و`log = mergeLog(state.log, incoming.log, mergedRead)` و`khatmaCount = max` و`last = state.last || incoming.last` مع بقاء الإعدادات المحلية (822-826)؛ تحسب `added` (828)؛ تكتب نسخة أمان `{savedAt, state: before}` في `BACKUP_KEY` داخل try (829-831)؛ تستبدل `state` وتحفظ وتعيد الرسم (832-834)؛ تكتب رسالة النتيجة (835-837)؛ تظهر زر التراجع وتضبط مؤقت إخفائه 10 ثوانٍ (838-843).
- **لماذا وُجدت:** نقطة التطبيق الوحيدة — نسخة أمان دائمًا + تراجع مؤقت، وبلا `checkKhatmaComplete` (الاستيراد ليس قراءة جديدة).
- **التأثيرات:** `state` + `localStorage` (الحالة + النسخة) + DOM (يشمل عدّاد الفهرس عبر `refreshAfterImport`).
- **تناديها:** `showImportPreview` (801). **تنادي:** `mergeRead`، `mergeLog`، `saveState`، `refreshAfterImport`، `BACKUP_KEY`.

#### `undoImport()` — سطر 847

- **التوقيع:** `function undoImport()`
- **ماذا تفعل وكيف:** تقرأ `BACKUP_KEY` بـ `JSON.parse` داخل try (848-853)؛ إن لا `saved.state` تكتب رسالة وتخفي الزر (854-858)؛ وإلا تستعيد `{...defaultState(), ...saved.state}` (859) وتحفظ (860) وتحذف النسخة (861) وتلغي المؤقت وتخفي الزر (862-863) وتعيد الرسم وتكتب رسالة التراجع (864-865).
- **لماذا وُجدت:** تراجع فوري بعد استيراد خاطئ — النسخة تبقى في `localStorage` حتى استيراد تالٍ أو تراجع.
- **التأثيرات:** `state` + `localStorage` (حذف النسخة) + DOM (يشمل عدّاد الفهرس عبر `refreshAfterImport`).
- **تناديها:** زر `#undoImportBtn` (1178). **تنادي:** `defaultState`، `saveState`، `refreshAfterImport`.

#### `pickImportFile(mode)` — سطر 869

- **التوقيع:** `function pickImportFile(mode)`
- **ماذا تفعل وكيف:** تحفظ الوضع في `pendingImportMode` (870)؛ تجد `#importFile` وترجع إن غاب (871-872)؛ تصفّر `input.value` (873) وتفتح المنتقي `input.click()` (874).
- **لماذا وُجدت:** زرّا الاستيراد يمرران الوضع ثم منتقي الملف واحد يقرأه `handleImportFile`.
- **تناديها:** زرّا `#importMergeBtn` (1175) و`#importReplaceBtn` (1176).

#### `handleImportFile(file)` — سطر 878

- **التوقيع:** `async function handleImportFile(file)`
- **ماذا تفعل وكيف:** ترجع إن لا ملف (879)؛ ترفض ما يتجاوز `PROGRESS_MAX_BYTES` بنافذة «الملف كبير جدًا» (880-888)؛ تقرأ `file.text()` داخل try (890-895)؛ تمرر النص إلى `parseProgressFile` وتعرض الخطأ في نافذة واحدة عند الفشل (896-900)؛ عند النجاح تعرض `showImportPreview(parsed.incoming, pendingImportMode, parsed.meta)` (901).
- **لماذا وُجدت:** البوابة الوحيدة لقراءة الملف — الحجم والقراءة والتحقق والمعاينة، بلا أثر عند أي فشل.
- **المدخلات:** `File`. **المخرجات:** لا شيء؛ نافذة أو معاينة.
- **تناديها:** حدث `change` على `#importFile` (1177). **تنادي:** `showModal`، `parseProgressFile`، `showImportPreview`، `PROGRESS_MAX_BYTES`.

### `currentTheme()` — سطر 906

- **التوقيع:** `function currentTheme()`
- **ماذا تفعل وكيف:** إن `state.theme` محفوظ `dark/light` ترجعه (907)؛ وإلا تقرأ `matchMedia('(prefers-color-scheme: dark)')` وترجع `dark` أو `light` (908).
- **لماذا وُجدت:** الثيم الفعلي: صريح محفوظ أو تلقائي حسب النظام عندما `theme === null`.
- **تناديها:** `applyTheme` (913)؛ `toggleTheme` (924).

### `applyTheme()` — سطر 912

- **التوقيع:** `function applyTheme()`
- **ماذا تفعل وكيف:** تحسب `dark` (913)؛ تضبط/تزيل `documentElement.dataset.theme` (914-915)؛ تحدّث زر `#themeToggle` (أيقونة `☀/☾` و`aria-pressed`) (916-919).
- **لماذا وُجدت:** تطبيق الثيم عبر `data-theme` على `html` (يكمله سكربت منع الوميض في `index.html:10`).
- **التأثيرات:** سمة DOM + نص الزر وحالته لقارئ الشاشة.
- **تناديها:** `toggleTheme` (926)؛ مستمع تغيّر النظام (1190)؛ `refreshAfterImport` (771)؛ `init` (1240 قبل الرسم). **تنادي:** `currentTheme`.

### `toggleTheme()` — سطر 923

- **التوقيع:** `function toggleTheme()`
- **ماذا تفعل وكيف:** تعكس الثيم الفعلي وتحفظه صراحة (يلغي التلقائي) (924) ثم تحفظ وتطبّق (925-926).
- **التأثيرات:** `state.theme` + حفظ + DOM.
- **تناديها:** زر `#themeToggle` (1187). **تنادي:** `currentTheme`، `saveState`، `applyTheme`.

### `changeFontSize(step)` — سطر 930

- **التوقيع:** `function changeFontSize(step)`
- **ماذا تفعل وكيف:** تجمع `step` على الحالية (احتياطي 1.9) وتقيّد `[1.2, 3]` (931) ثم تحفظ وتطبّق (932-933).
- **لماذا وُجدت:** تكبير/تصغير خط القارئ بحدّين ثابتين (rem).
- **التأثيرات:** `state.fontSize` + حفظ + متغير CSS.
- **تناديها:** زرّا `#fontPlus/#fontMinus` (1185-1186). **تنادي:** `saveState`، `applyReaderFontSize`.

### `applyReaderFontSize()` — سطر 937

- **التوقيع:** `function applyReaderFontSize()`
- **ماذا تفعل وكيف:** `#reader.style.setProperty('--reader-size', fontSize + 'rem')` (938).
- **لماذا وُجدت:** الضبط عبر متغير CSS حصرًا — `style.fontSize` المباشر ممنوع لأنه يقتل `clamp()` المتجاوب (`css/style.css:204` و`:264`).
- **التأثيرات:** خاصية CSS على `#reader` فقط.
- **تناديها:** `changeFontSize` (933)؛ `refreshAfterImport` (770)؛ `init` (1243).

### `renderStats()` — سطر 942

- **التوقيع:** `function renderStats()`
- **ماذا تفعل وكيف:** `total = readTotal()` (943) و`percent = total/TOTAL_AYAS*100` (944)؛ تكتب `#percent` بصيغتين عشريتين (945) و`#statsLine` (مقروء/كلي • متبقٍ) (946) وعرض `#progressFill` (947) و`aria-valuenow/max` على `#khatmaProgress` (948-949) و`#todayCount` (اليوم: log ← goal) (950) و`#khatmaCount` (951)؛ فرع `last`: زر المتابعة `تابع: name آية N` و`آخر قراءة: سورة…` (952-954) أو الافتراضي `تابع القراءة / لم تبدأ…` (955-958)؛ ثم شريط المتابعة اللاصق: `#stripToday` و`#stripPercent` و`--p` على `#trackStrip` (959-965).
- **لماذا وُجدت:** لوحة الختمة الوحيدة — نسبة وشريط وورد اليوم وآخر قراءة وعدد الختمات، مع `aria-live` وإمكانية وصول، وشريط الجوال اللاصق.
- **التأثيرات:** كتابة عناصر DOM (`#percent`، `#statsLine`، `#progressFill`، `#khatmaProgress` سمتان، `#todayCount`، `#khatmaCount`، `#continueBtn`، `#lastReadLine`، `#trackStrip` و`#stripToday`/`#stripPercent`)؛ لا تخزين.
- **تناديها:** `refreshAyahUI` (140)؛ `resetKhatma` (365)؛ `checkKhatmaComplete` (975)؛ `bindEvents/setGoal` (1153)؛ `refreshAfterImport` (773)؛ `init` (1242). **تنادي:** `readTotal`، `todayKey`.

### `checkKhatmaComplete()` — سطر 969

- **التوقيع:** `async function checkKhatmaComplete()`
- **ماذا تفعل وكيف:** إن `readTotal() < 6236` ترجع `false` دون أثر (970)؛ وإلا: تزيد العداد (971) وتصفّر `read` و`last` (972-973) وتحفظ (974) وتعيد رسم الإحصاء والقائمة والقارئ (975-977)؛ تعرض نافذة تهنئة بزر واحد `single:true` بعدد الختمات (978-983)؛ ترجع `true` (984).
- **لماذا وُجدت:** الاحتفال التلقائي الوحيد عند بلوغ 6236 — يصفّر أولًا ثم يهنئ ويبدأ ختمة جديدة تلقائيًا. `renderList` يصفّر عدّاد الفهرس تلقائيًا (سطر 212).
- **التأثيرات:** `state` + حفظ + 3 رسومات (فيها عدّاد الفهرس) + نافذة.
- **تناديها:** نقرة الآية (267)؛ `completeCurrentSurah` (342). **تنادي:** `readTotal`، `saveState`، `renderStats`، `renderList`، `openSurah`، `showModal`.

### `showModal({title, body, confirmText, danger, single, checkboxLabel})` — سطر 991

- **التوقيع:** `function showModal({...})` ترجع `Promise<boolean | {ok, checked}>`
- **ماذا تفعل وكيف:** تحفظ التركيز السابق (993)؛ تبني `overlay > card[role=alertdialog][aria-modal]` + عنوان `h2#modalTitle` ووصف `p#modalDesc` مربوطين بـ `aria-labelledby/describedby` (994-1008)؛ صندوق إقرار اختياري `label.modal-check > checkbox + span` غير معلَّم (1009-1020)؛ زر تأكيد `btn-danger/btn-primary` (1023-1027) وزر `تراجع btn-quiet` إلا في `single` (1028-1035)؛ تلحق بالـ `body` وتمنع التمرير (1037-1039)؛ `close(value)` تزيل وتمسح المنع وتعيد التركيز وتحلّ الوعد (بـ `{ok, checked}` عند وجود صندوق) (1041-1046)؛ تعطيل زر التأكيد حتى تعليم الصندوق (1048-1051)؛ ربط التأكيد/التراجع (1052-1053)؛ النقر خارج البطاقة يلغي إلا في `danger` (1054)؛ `Esc` يلغي وحبس `Tab` داخل البطاقة (1055-1063)؛ التركيز الأولي على التراجع في الخطر وإلا التأكيد (1064).
- **لماذا وُجدت:** نظام النوافذ الوحيد بدل `alert/confirm` الأصليين (ممنوعان) — تأكيد خطر أو إشعار بزر واحد، مع حبس تركيز و`Esc` وإعادة تركيز.
- **المدخلات/المخرجات:** خيارات مفككة أعلاه؛ تحلّ بـ `boolean` عادة أو `{ok, checked}` مع صندوق.
- **التأثيرات:** DOM مؤقت + `body.overflow` + إدارة التركيز.
- **تناديها:** `completeCurrentSurah` (333)؛ `resetKhatma` (349)؛ `checkKhatmaComplete` (978)؛ `showImportPreview` (794)؛ `handleImportFile` (881، 893، 898).

### `cachedSurahCount()` — سطر 1072

- **التوقيع:** `function cachedSurahCount()`
- **ماذا تفعل وكيف:** حلقة 1..114 تعدّ مفاتيح `CACHE_PREFIX+i` الموجودة (1073-1079)؛ أي استثناء يوقف العدّ (1077).
- **لماذا وُجدت:** عدد السور المحفوظة بفحص متزامن سريع — يغذي الزر والشريط.
- **تناديها:** `updateCacheBar` (1083).

### `updateCacheBar()` — سطر 1082

- **التوقيع:** `function updateCacheBar()`
- **ماذا تفعل وكيف:** تحسب `n` (1083)؛ تحدّث `#cacheBarBtn` (`السور المحفوظة: N / 114`) (1084-1085)؛ إن غاب `#cacheBar` ترجع (1086-1087)؛ وإلا تحدّث `.cache-text` وعرض `.cache-fill` بنسبة `n/114` (1088-1089).
- **لماذا وُجدت:** إبقاء نص الزر وشريط الحالة حيّين بعد كل حفظ وكل تقدّم خلفي.
- **التأثيرات:** كتابة DOM فقط.
- **تناديها:** `saveSurahCache` (90)؛ `showCacheBar` (1120)؛ حدث `surah-cache-progress` (1184)؛ `init` (1245 — الزر فقط). **تنادي:** `cachedSurahCount`.

### `hideCacheBar()` — سطر 1092

- **التوقيع:** `function hideCacheBar()`
- **ماذا تفعل وكيف:** تمسح المؤقت وتصفّره (1093-1094) وتزيل `#cacheBar` بـ `?.` (1095).
- **لماذا وُجدت:** إخفاء الشريط (يدوي بزر ✕ أو تلقائي بعد 5 ثوانٍ أو قبل إنشاء جديد).
- **تناديها:** زر ✕ (1117)؛ مؤقت الـ 5 ثوانٍ (1121)؛ بداية `showCacheBar` (1099).

### `showCacheBar()` — سطر 1098

- **التوقيع:** `function showCacheBar()`
- **ماذا تفعل وكيف:** تزيل القديم أولًا (1099)؛ تبني `#cacheBar.cache-bar[role=status]` من نص + مسار تعبئة + زر إغلاق `✕` (1100-1118)؛ تلحق بالـ `body` (1119)؛ تحدّث الأرقام (1120)؛ تضبط مؤقت الإخفاء 5000ms (1121).
- **لماذا وُجدت:** شريط حالة يدوي فقط بزر الـ footer — لا ظهور تلقائي في `init` (تعليق سطر 1068).
- **التأثيرات:** إنشاء DOM + مؤقت.
- **تناديها:** زر `#cacheBarBtn` (1172). **تنادي:** `hideCacheBar`، `updateCacheBar`.

### `updateNetStatus()` — سطر 1125

- **التوقيع:** `function updateNetStatus()`
- **ماذا تفعل وكيف:** تجد `#netStatus` وترجع إن غابت (1126-1127)؛ إن متصل: `hidden=true` وتزيل `offline` (1128-1130)؛ وإلا: تظهرها بنص `أنت تعمل الآن دون اتصال…` وتضيف `offline` (1131-1135).
- **لماذا وُجدت:** شارة الاتصال — مخفية عند الاتصال، ظاهرة فقط دون إنترنت (`index.html:44`).
- **تناديها:** `bindEvents` (1180) وحدثا `online/offline` (1181-1182).

### `applyGoalUI()` — سطر 1139

- **التوقيع:** `function applyGoalUI()`
- **ماذا تفعل وكيف:** تجد `#dailyGoal` وترجع إن غاب (1140-1141)؛ تكتب `state.dailyGoal` نصًا (1142) وتضبط `aria-valuenow` (1143).
- **لماذا وُجدت:** مزامنة عدّاد الهدف الظاهر مع الحالة بعد الاستيراد أيضًا، لا في `bindEvents` فقط.
- **تناديها:** `bindEvents` (1148)؛ `refreshAfterImport` (769).

### `bindEvents()` — سطر 1147

- **التوقيع:** `function bindEvents()`
- **ماذا تفعل وكيف:** تهيئ `#dailyGoal` عبر `applyGoalUI` (1148)؛ تعرّف `setGoal(v)` مقيّدة `[1,500]` مع كتابة وحفظ وإحصاء (1149-1154)؛ تربط: `goalUp/Down` (1155-1156)، أسهم `dailyGoal` (↑/→ +1، ↓/← −1، Home→1، End→500) (1157-1162)، بحث `debounced 200ms → renderList` (1163)، أزرار `data-goto` (1164-1166)، متابعة (آخر سورة+آية أو 1) (1167-1170)، `resetBtn → resetKhatma` (1171)، `cacheBarBtn → showCacheBar` (1172)، نقل التقدم: تصدير (1174)، استيراد/دمج (1175)، استبدال (1176)، `change` على `#importFile` (1177)، تراجع (1178)، `online/offline → updateNetStatus` (1180-1182)، `surah-cache-progress → updateCacheBar` (1184)، خط (1185-1186)، ثيم (1187) + تتبع النظام في الوضع التلقائي فقط (1189-1191)، إتمام السورة (1192)، سابق/تالي بحراسة الحدود (1193-1198)، طي الفهرس `collapsed` مع نص عرض/طي و`aria-expanded` (1199-1205).
- **لماذا وُجدت:** ربط كل أزرار الواجهة مرة واحدة من `init` (تعليق سطر 1146).
- **التأثيرات:** مستمعو أحداث + تهيئة `#dailyGoal`.
- **تناديها:** `init` (1239) فقط. **تنادي (غير مباشر):** كل ما سبق عبر الأحداث.

### `renderDaily()` — سطر 1209

- **التوقيع:** `async function renderDaily()`
- **ماذا تفعل وكيف:** تجلب `data/daily.json` (1211) وترمي إن `!ok` (1212)؛ تقبل مصفوفة مباشرة أو `{daily}` (1214) — والملف الحالي كائن `{daily: [{text, ref} × 365]}` (آية لكل يوم، بلا تكرار) — وترمي إن فارغة (1215)؛ تحسب يوم السنة `floor((now - Jan0)/86400000)` (1216-1217)؛ تختار `list[day % len]` اختيارًا حتميًا (1218) وترمي إن بلا نص (1219)؛ تكتب `#dailyText` و`#dailyRef` (`سورة ref`) (1220-1221)؛ عند أي فشل تكتب `تعذر تحميل آية اليوم.` (1223-1224).
- **أين تُعرض:** بطاقة `section.daily` فوق القارئ (`index.html:88-91`): شارة ثابتة `span.daily-badge` (سطر 89) + سطر النص `p.daily-text` (سطر 90) الذي يضم `#dailyText` ويليه مرجعه ملاصقًا `#dailyRef.daily-ref` (داخل نفس العنصر لا عنصر `flex` منفصل عند الحافة، `dir="auto"` للنص المختلط). الأنماط في `css/style.css` (صف `align-items:center` بحشوة `--pad-inline` وفجوة `--gap-md` حسب نظام الشرائط).
- **لماذا وُجدت:** آية اليوم — اختيار حتمي حسب يوم السنة (`dayOfYear % الطول`) يعمل دون إنترنت بعد أول تحميل.
- **التأثيرات:** كتابة `#dailyText` و`#dailyRef` فقط.
- **تناديها:** `init` (1244 دون انتظار).

### `init()` — سطر 1230

- **التوقيع:** `async function init()`
- **ماذا تفعل وكيف:** تجلب `data/surahs.json` (1232) وترمي إن `!ok` (1233) وتحفظ في `surahs` (1234)؛ عند الفشل تكتب `تعذر تحميل فهرس السور.` في `#surahList` وترجع (1235-1238)؛ ثم بالترتيب: `bindEvents` (1239)، `applyTheme` قبل الرسم لمنع الوميض (1240)، `renderList` (1241 — يملأ الفهرس وعدّاده)، `renderStats` (1242)، `applyReaderFontSize` (1243)، `renderDaily` دون انتظار (1244)، `updateCacheBar` للزر فقط (1245)، `renderTransferStatus` لسطر «آخر نسخة» (1246)؛ تطلب `navigator.storage.persisted()` ثم `persist()` إن لم يكن دائمًا (1248-1252)؛ تضبط `history.scrollRestoration = 'manual'` وتصعد للأعلى (1253)؛ تبدأ التحميل الخلفي `SurahPreloader.start(last.surah || 1)` بعد `load` بثانيتين (1254-1258)؛ تكتب سنة الحقوق في `#year` (1260-1261)؛ لا فتح تلقائي لسورة (1262).
- **لماذا وُجدت:** نقطة الدخول — تحميل الفهرس ثم رسم كل شيء. تحتاج خادمًا محليًا لأن `fetch` يُحجب عبر `file://` (تعليق سطر 1229).
- **التأثيرات:** كل رسومات الإقلاع + بدء التحميل الخلفي.
- **تناديها:** الاستدعاء المباشر سطر 1265. **تنادي:** كل رسومات الإقلاع + `SurahPreloader.start`.

## 5. مفاتيح `localStorage` وشكلها

### `quran_tracker_v1` (سطر 10، يُقرأ 57-64، يُكتب 67-69)

```js
{
  read: { "18:5": "2026-10-14", /* … — قيم true القديمة مقبولة كـ truthy */ },
  last: { surah: 18, ayah: 5, name: "الكهف" }, // أو null
  khatmaCount: 0,
  dailyGoal: 20,   // يُقيَّد 1-500 في setGoal (سطر 1150) وعند الاستيراد (سطر 707)
  fontSize: 1.9,   // rem — يُقيَّد 1.2-3 في changeFontSize (سطر 931) وعند الاستيراد (سطر 708)
  log: { "2026-10-14": 7 }, // بتوقيت المتصفح المحلي (todayKey سطر 36)
  theme: null,     // null تلقائي | 'dark' | 'light'
  lastExportAt: null // ISO لآخر تصدير من هذا الجهاز أو null
}
```

- **الشكل لم يتغير في v2:** ملف التقدم يستخدم `state.ayahs`، أما `localStorage` فيبقى بخريطة `read` (`"سورة:آية" → تاريخ | true`).
- الافتراضيات في `defaultState` (سطر 54)؛ الدمج `{...defaultState(), ...saved}` (60) يحمي البيانات القديمة.
- `read`: المفتاح `"سورة:آية"` والقيمة تاريخ التعليم (نص) — العدّ `Object.keys().length` (95). التراجع ينقص `log[day]` فقط عندما القيمة نصًا (129). عدّاد الفهرس يعدّ السور المكتملة منه عبر `completedSurahCount` (157).
- `last`: تُصفَّر عند التراجع عن نفس الآية (131) وعند التصفير/الاكتمال (361، 973).
- `lastExportAt`: يُحدَّث بعد كل تصدير (سطر 608)، ويأخذه الاستبدال من `exportedAt` الملف (سطر 819)، ولا يتغير بالدمج (فرع الدمج لا يمسه).
- الحقول الوصفية (`appVersion`، `exportedAtLocal`، `timezone`، `source`، `device`، `summary`) توجد في **الملف فقط** ولا تُحفظ هنا.

### `quran_tracker_backup_v1` (سطر 12)

```js
{ savedAt: "2026-10-19T09:12:00.000Z", state: { … نفس شكل quran_tracker_v1 … } }
```

- يُكتب في `applyImport` (سطر 830) قبل أي تعديل، يقرأه `undoImport` (850)، ويُحذف بعد التراجع (861). يبقى بعد انتهاء مهلة زر التراجع (10 ثوانٍ، سطر 841-843) حتى استيراد تالٍ.

### `surah_cache_<number>` (بادئة سطر 13)

```js
{ ayahs: [{ number: 1, text: "…" }, …] }
```

- يُقرأ في `getCachedAyahs` (80-81)، يُكتب في `saveSurahCache` (89)، يُعدّ في `cachedSurahCount` (1072).

## 6. خريطة النداءات الرئيسية

```text
init (1230)
├─ fetch data/surahs.json → surahs (1232-1234)
├─ bindEvents (1239)
│   ├─ applyGoalUI → #dailyGoal (1148)
│   ├─ search(input, debounce 200ms) → renderList → surahMatches → normalizeArabic/normalizeDigits (1163)
│   ├─ [data-goto] → openSurah (1164-1166)
│   ├─ continueBtn → openSurah(last.surah, last.ayah) أو openSurah(1) (1167-1170)
│   ├─ resetBtn → resetKhatma → showModal → saveState/renderList/renderStats/openSurah (1171)
│   ├─ cacheBarBtn → showCacheBar → updateCacheBar → cachedSurahCount (1172)
│   ├─ exportBtn → exportProgress → collectProgress → Blob/download (1174)
│   ├─ importMerge/ReplaceBtn → pickImportFile → #importFile (1175-1176)
│   ├─ importFile change → handleImportFile → parseProgressFile → showImportPreview → applyImport (1177)
│   ├─ undoImportBtn → undoImport → quran_tracker_backup_v1 (1178)
│   ├─ online/offline → updateNetStatus (1180-1182)
│   ├─ surah-cache-progress → updateCacheBar (1184)
│   ├─ fontPlus/Minus → changeFontSize → applyReaderFontSize (1185-1186)
│   ├─ themeToggle → toggleTheme → currentTheme/applyTheme (1187)
│   ├─ completeSurahBtn → completeCurrentSurah → showModal → markAyahRead… → refreshAyahUI → checkKhatmaComplete → openSurah (1192)
│   └─ prevSurah/nextSurah → openSurah(N±1) (1193-1198)
├─ applyTheme → currentTheme (1240)
├─ renderList → surahMatches/readCountOf/surahStatusText + updateSurahIndexCount (1241)
├─ renderStats → readTotal/todayKey + #trackStrip (1242)
├─ applyReaderFontSize (1243)
├─ renderDaily — fetch data/daily.json → #dailyText/#dailyRef (1244)
├─ updateCacheBar — نص الزر فقط (1245)
├─ renderTransferStatus — سطر «آخر نسخة» (1246)
├─ navigator.storage.persisted → persist (1248-1252)
└─ SurahPreloader.start(last.surah || 1) (1254-1258)

openSurah (273)
├─ loadSurahAyahs → getCachedAyahs / OFFLINE_SURAHS+saveSurahCache / fetch API+saveSurahCache (288)
├─ highlightActiveSurah (280)
├─ stripBasmalaPrefix للآية 1 (عدا 1 و9) (308)
└─ createAyahElement لكل آية (312)
    └─ onclick: toggleAyahRead (260) → refreshAyahUI (→ saveState/renderStats/updateSurahBadge/updateSurahIndexCount) → نقل صنف last → checkKhatmaComplete
        └─ عند 6236: تصفير + renderStats/renderList/openSurah + showModal تهنئة (969-985)

exportProgress (596)
└─ collectProgress (570) → localStamp/timezoneInfo/detectSource/detectDevice/buildSummary/readToAyahs
   └─ Blob → noor-progress-YYYY-MM-DD-HHmmss.json → lastExportAt (603-609)

import: #importFile change (1177)
└─ handleImportFile (878) — سقف 5MB
   └─ parseProgressFile (615) → ayahsToRead (499) أو read v1 → sanitizeLog
      └─ meta وصفي → showImportPreview (780) → describeImportMeta (718)
         └─ applyImport (805) → mergeRead/mergeLog → BACKUP_KEY → refreshAfterImport (768)
            └─ undoImport (847) — 10 ثوانٍ والنسخة تبقى
```
