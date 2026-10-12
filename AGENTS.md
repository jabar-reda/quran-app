# AGENTS.md — دليل الوكيل لمشروع «نور — مصحف الختمة»

> هذا الملف موجّه لأي وكيل (AI agent) سيعمل على هذا المستودع. اقرأه قبل أي تعديل.

## 1. ما هذا المشروع؟

تطبيق ويب ثابت (Static, بدون بناء، بدون اعتماديات) يعمل داخل المتصفح لمساعدة المسلم على ختم القرآن آية آية:

- فهرس 114 سورة مع بحث (عربي / إنجليزي / رقم).
- قارئ بالرسم العثماني (خط Amiri Quran) — اللمس/النقر يعلّم الآية كمقروءة، واللمس الثاني يتراجع.
- لوحة ختمة: نسبة مئوية + شريط تقدم + ورد اليوم (هدف افتراضي 20) + آخر قراءة + عدد الختمات.
- كل الحالة محفوظة في `localStorage` فقط — لا حسابات، لا باك-إند، لا إرسال بيانات.
- اللغة: عربي RTL بالكامل (`index.html:2`).

## 2. التقنية والتشغيل

- **Stack:** ملفات خام فقط: `index.html` + `css/style.css` + `js/app.js` + `js/offline-surahs.js` + `data/surahs.json`. خطوط Google Fonts عبر CDN.
- **لا يوجد:** `package.json`، bundler، tests، framework. لا تضف أدوات بناء إلا بطلب صريح.
- **التشغيل المحلي (إلزامي بخادم، ليس `file://`):**
  ```bash
  python3 -m http.server 8000
  # افتح http://localhost:8000
  ```
  السبب: `fetch('data/surahs.json')` في `js/app.js:316` يُحجب ببروتوكول `file://` في بعض المتصفحات.
- **التحقق بعد أي تعديل:** افتح الصفحة بالخادم المحلي، جرّب: بحث عن سورة → فتح سورة → تعليم آية/التراجع → إتمام السورة → تغيير الهدف → تصغير/تكبير الخط → وضع offline (4 سور فقط تعمل).

## 3. هيكل الملفات

```
index.html            الهيكل الكامل: topbar + hero/بحث + dashboard (3 بطاقات) + فهرس + قارئ + footer
css/style.css         الثيم (أخضر Material) + الشبكة المتجاوبة + صقل premium-details في الأسفل
js/app.js             كل المنطق (~331 سطر): الحالة، الفهرس، التحميل، التعليم، الإحصاء، الأحداث
js/offline-surahs.js  يعرّف window.OFFLINE_SURAHS — نص 4 سور مضمّن (الفاتحة 1، الإخلاص 112، الفلق 113، الناس 114)
data/surahs.json      فهرس 114 سورة: {number, name (عربي), english, ayahs (العدد), type (مكية/مدنية)}
assets/logo/          الشعار: المفهوم المعتمد C1 «نون الختمة» + favicon + USAGE.md (لا تغيّر الشعار دون طلب)
.opencode/skills/     مهارات محلية متاحة: code-simplification, frontend-design, premium-details, find-skills
.agents/skills/       مهارات مثبتة من السوق: modern-javascript-patterns (لملفات JS)
```

## 4. تدفق البيانات والحالة (الأهم)

### 4.1 مفاتيح `localStorage`

| المفتاح | الشكل | الوصف |
|---|---|---|
| `quran_tracker_v1` (`js/app.js:3`) | `{read, last, khatmaCount, dailyGoal, fontSize, log, theme}` | حالة الختمة — **لا تغيّر شكله** حتى لا تنكسر بيانات المستخدمين القدامى (`js/app.js:29-37` يدمج مع قيم افتراضية) |
| `surah_cache_<number>` (`js/app.js:4`) | `{ayahs: [{number, text}]}` | نص كل سورة بعد أول جلب ناجح |

تفاصيل `quran_tracker_v1`:
- `read`: كائن مفاتيحه `"سورة:آية"` (مثال `"18:5"`) وقيمتها `true`. العد = `Object.keys(state.read).length`.
- `last`: `{surah, ayah, name}` أو `null`.
- `log`: `{ "YYYY-MM-DD": عدد آيات اليوم }` — المفتاح بتوقيت المتصفح المحلي (`js/app.js:14-19`).
- `dailyGoal` افتراضي `20`، و`fontSize` افتراضي `1.9` (rem).
- `theme`: ‏`null` (تلقائي حسب النظام) أو `'dark'`/`'light'` — يطبَّق عبر `data-theme` على `html`.

### 4.2 مصدر نص السور (`js/app.js:139-152`)

1. إن وُجد `surah_cache_<n>` → استخدمه.
2. وإلا إن وُجد في `window.OFFLINE_SURAHS` (السور 1، 112، 113، 114 فقط) → احفظه واستخدمه.
3. وإلا `fetch('https://api.alquran.cloud/v1/surah/<n>/quran-uthmani')` → خزّن `{number: numberInSurah, text}` ثم احفظه.
4. عند الفشل: رسالة خطأ ثابتة في `js/app.js:199` تذكر السور المحفوظة — حدّثها إن أضفت سورًا offline جديدة.

### 4.3 ثوابت وقواعد خاصة

- `TOTAL_AYAS = 6236` (`js/app.js:2`) — النسبة = المقروء ÷ 6236.
- البسملة الافتتاحية تُعرض لكل السور **ما عدا 1 و9** (`js/app.js:206`).
- `resetKhatma` (`js/app.js:234-244`): يسأل `confirm` أولًا؛ يحتسب ختمة مكتملة فقط إذا كان المقروء ≥ `TOTAL_AYAS - 10`.
- `checkKhatmaComplete` (`js/app.js:270-278`): عند بلوغ 6236 يعرض `alert` ثم **يصفّر تلقائيًا** ويزيد `khatmaCount`.
- `completeCurrentSurah` (`js/app.js:222-232`): يعلّم كل آيات السورة الحالية (يستخدم الكاش إن وُجد وإلا عدد آيات الفهرس) ثم يعيد فتح السورة لإعادة الرسم.
- البحث (`js/app.js:109-116`): مطابقة `name.includes(query)` عربي حرفي + `english` غير حساس لحالة الأحرف + رقم Surah مطابق تمامًا. البحث `debounced` 200ms (`js/app.js:287`).

## 5. الواجهة وCSS

- التصميم: topbar ثابتة + hero بحث على طريقة Google + `dashboard` بثلاث بطاقات (`index.html:52-73`) + شبكة `layout` بعمودين (فهرس 320px + قارئ) (`css/style.css:66`).
- متغيرات الألوان في `:root` (`css/style.css:2-12`): `--green:#188038` هو الأساسي. حافظ عليه.
- الآية المقروءة: `.ayah.read` خضراء؛ آخر آية: `.ayah.last` بخلفية + outline (`css/style.css:86-89`).
- أرقام الآيات: `.ayah-num` حبة دائرية — الأرقام لاتينية (`Roboto`) داخل نص عربي، وهذا مقصود.
- قسم الصقل `premium-details` في (`css/style.css:114-160`): لمسات فقط (hover مقيد بـ `hover:hover`، press بـ `scale(0.96)`، `prefers-reduced-motion`، `tabular-nums`). **لا تعيد التصميم** — أي تحسين بصري جديد يجب أن يبقى ضمن هذا النمط (~10% صقل).
- المتجاوب (`css/style.css:97-112`, breakpoint 960px): تُخفى `top-links`، الفهرس قابل للطي بزر `indexToggle`، خط القارئ `clamp(1.45rem,5.5vw,1.7rem)`.
- إمكانية الوصول (لا تكسرها): رابط `skip`، `aria-live` على الإحصاءات، `role=progressbar` مع `aria-valuenow` يُحدّث في (`js/app.js:259`)، `:focus-visible` واضح، كل الأزرار `type="button"`، أهداف لمس ≥44px على الجوال.

## 6. قواعد العمل للوكيل

1. **Vanilla فقط:** لا تضف React/Vue/Tailwind/npm دون طلب صريح من المستخدم.
2. **حافظ على شكل `localStorage`:** أي حقل جديد يجب أن يكون اختياريًا مع قيمة افتراضية في `loadState` (`js/app.js:29-37`).
3. **العربية أولًا:** أي نص جديد للمستخدم بالعربية الفصحى المبسطة، RTL سليم، `dir="auto"` للنص المختلط كما في (`index.html:91`).
4. **الأرقام:** أرقام الآيات والإحصاءات لاتينية (`tabular-nums`) — لا تعرّبها لأرقام مشرقية دون طلب.
5. **الأداء:** استخدم `DocumentFragment` كما في `renderList`/`openSurah`؛ لا تعيد رسم القائمة الكاملة عند تعليم آية واحدة (استخدم `updateSurahBadge`).
6. **الشبكة:** لا تغيّر `api.alquran.cloud` وطبعة `quran-uthmani` دون طلب — هما مصدر النص الرسمي (موثق في README).
7. **الشعار:** المعتمد `noor-c1-icon-color.svg` في الهيدر و`favicon.svg` للتبويب (انظر `assets/logo/USAGE.md`).
8. **الـ commits بالإنجليزية دائمًا:** كل رسائل `git commit` بالإنجليزية الموجزة (imperative، سطر واحد ≤72 حرفًا، مثال: `Fix today counter inflation on ayah untoggle`). نصوص الواجهة والتعليقات تبقى عربية — القاعدة للـ commits فقط.
9. **الوكلاء الفرعيون:** ممنوع إنشاء وكلاء مخصصين في `.opencode/agents/` — الطبقة المجانية خارج OpenCode ترفض إطلاقهم بخطأ `free tier can only be used from within OpenCode` (حدث فعلي موثق، والملف حُذف لهذا السبب). القاعدة للمهام المتوازية: أطلق **وكيلين مدمجين `general` بالتوازي كحد أقصى**، بمهمة واحدة لكل وكيل **على ملفات مختلفة حصرًا** (مثال: الأول `js/app.js`، الثاني `css/style.css` + `index.html`) حتى لا تتضارب القرارات على نفس الملف. لا تطلق وكيلًا ثالثًا ولا تلمس أنت الملفات أثناء عملهما.
10. **الرفع لجيتهاب بعد كل commit:** كل `commit` يتبعه `push` فورًا إلى `origin` (الفرع الحالي) دون انتظار طلب منفصل. لا تترك commits محلية معلقة.

## 7. مهام شائعة (أين تعدّل)

| المهمة | المكان |
|---|---|
| إضافة سورة offline جديدة | أضفها لـ `js/offline-surahs.js` بنفس الشكل `{ayahs:[{number,text}]}` وحدّث رسالة الخطأ في `js/app.js:199` وREADME |
| تصدير/استيراد التقدم (مقترح في README) | دوال جديدة بجانب `saveState/loadState` + زران في بطاقة «المتابعة» (`index.html:64-72`) — JSON للمفتاح `quran_tracker_v1` |
| تغيير الهدف الافتراضي | `js/app.js:30` + `value="20"` في (`index.html:62`) معًا |
| تغيير الخط/الألوان | `css/style.css:2-12` والخط في (`css/style.css:85`) + رابط Google Fonts في (`index.html:10`) |
| سورة جديدة/تصحيح عدد آيات | `data/surahs.json` فقط (التقدم كنسبة يتبع `TOTAL_AYAS` تلقائيًا) |

## 8. ما هو خارج النطاق حاليًا (لا تفترض وجوده)

لا يوجد راوتر/روابط سور عميقة، لا Service Worker (الكاش `localStorage` فقط)، لا مزامنة بين الأجهزة، لا وضع ليلي، لا تفسير/تلاوة صوتية. أيٌّ منها يُبنى من الصفر وبطلب صريح.
