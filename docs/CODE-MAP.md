# خريطة الكود البصرية — «نور · مصحف الختمة»

> كيف يعمل الكود فعلًا (وليس كيف يُفترض). الملف مرجع بصري + سجل المشاكل المنطقية المؤكدة.
> أرقام الأسطر حسب `js/app.js` الحالي (1251 سطرًا). الرسومات بصيغة Mermaid وتُعرض على GitHub مباشرة.

## 1. الصورة الكاملة: من أين تأتي البيانات وإلى أين تذهب

```mermaid
flowchart LR
    subgraph UI["الواجهة index.html"]
        S["بحث + فهرس<br/>surahList"]
        R["القارئ<br/>reader"]
        D["اللوحة<br/>stats/today/last"]
    end
    subgraph APP["المنطق js/app.js"]
        ST["الحالة state<br/>في الذاكرة"]
        EV["الأحداث<br/>bindEvents"]
        TR["نقل التقدم<br/>تصدير/استيراد"]
    end
    subgraph STORE["التخزين localStorage"]
        K["quran_tracker_v1<br/>التقدم"]
        C["surah_cache_N<br/>نص السور"]
        B["quran_tracker_backup_v1<br/>نسخة ما قبل الاستيراد"]
    end
    OFF["offline-surahs.js<br/>4 سور مضمنة"]
    API["api.alquran.cloud<br/>quran-uthmani"]
    NET["data/surahs.json<br/>الفهرس 114"]
    FILE["ملف JSON v2<br/>noor-progress-…json"]

    EV --> ST
    S <--> ST
    R <--> ST
    ST <--> K
    ST --> TR
    TR -.->|"تصدير Blob"| FILE
    FILE -.->|"استيراد + تحقق"| TR
    TR --> ST
    TR --> B
    TR -.->|"تراجع"| B
    R <--> C
    OFF --> C
    API --> C
    PRE["preload.js<br/>طابور خلفي ≤1MB/s<br/>يتوقف أثناء جلب المستخدم"] --> C
    PRE -.->|"surah-cache-progress"| D
    NET --> S
    ST --> D
```

القاعدة الذهبية: **كل تغيير في `state` يُحفظ فورًا (`saveState`) ثم تُحدَّث اللوحة (`renderStats`)** — ما عدا مسارًا واحدًا فيه خلل (انظر مشكلة A).

## 2. فتح سورة: شلال التحميل + السباق الخفي

```mermaid
flowchart TD
    A["openSurah N<br/>app.js:259"] --> T["رسم العنوان + 'جاري التحميل'<br/>:263-265"]
    T --> Q{"surah_cache_N<br/>موجود؟<br/>:203"}
    Q -- نعم --> RENDER["رسم الآيات<br/>:284-299"]
    Q -- لا --> O{"في OFFLINE_SURAHS؟<br/>1/112/113/114<br/>:205"}
    O -- نعم --> SAVE1["حفظ في الكاش<br/>:206"] --> RENDER
    O -- لا --> F["fetch API<br/>:209"] --> OK{"نجح؟<br/>:210"}
    OK -- نعم --> SAVE2["حفظ في الكاش<br/>:213"] --> RENDER
    OK -- لا --> ERR["رسالة الخطأ<br/>app.js:278"]
    RENDER --> B{"بسملة؟<br/>كل السور عدا 1 و 9<br/>:287"}
    B -- تعرض --> STRIP["تجريد بادئة البسملة<br/>من نص الآية 1 للعرض فقط<br/>:293-296"]
```

✅ **السباق محمي:** حارس `if (currentSurah !== number) return` موجود بعد `await` في مسار الفشل (سطر 277) وبعد النجاح قبل الرسم (سطر 282). لذلك نقرة سريعة «البقرة ثم الإخلاص» لا تعرض نص البقرة تحت عنوان الإخلاص.

## 3. تعليم آية: آلة الحالة + محاسبة اليوم

```mermaid
stateDiagram-v2
    [*] --> غير_مقروءة
    غير_مقروءة --> مقروءة: نقرة + markAyahRead<br/>:114 — read=تاريخ اليوم + logاليوم+1 + last=هذه الآية
    مقروءة --> غير_مقروءة: نقرة ثانية + toggleAyahRead<br/>:124 — إنقاص log يوم التعليم الأصلي + حذف المفتاح
    مقروءة --> مقروءة: نقرة على آية أخرى<br/>last تنتقل للجديدة
```

الفكرة الذكية: القيمة المخزنة **تاريخ التعليم** لا `true`، فيُخصم التراجع من يومه الصحيح لا من اليوم الحالي.
القيم القديمة `true` (قبل التحديث) تعمل كـ truthy لكن تراجعها لا يُنقص أي يوم — سلوك مقصود وموثق (`toggleAyahRead` سطر 129).

```mermaid
sequenceDiagram
    participant U as المستخدم
    participant AY as عنصر الآية
    participant ST as state + localStorage
    participant UI as اللوحة + شارة الفهرس
    U->>AY: نقرة
    AY->>ST: toggleAyahRead ‏(app.js:124)
    AY->>ST: saveState + renderStats + updateSurahBadge ‏(refreshAyahUI ‏:138)
    AY->>AY: classList.toggle read + نقل تمييز last ‏(:248-252)
    AY->>ST: checkKhatmaComplete ‏(app.js:955)
```

## 4. دورة الختمة: المسارات الثلاثة للتصفير

```mermaid
flowchart TD
    P["التقدم readTotal<br/>app.js:94"] --> K{"بلغ 6236؟<br/>:956"}
    K -- "نعم عبر نقرة" --> A1["checkKhatmaComplete :955<br/>khatmaCount++ ثم تصفير + نافذة تهنئة showModal"]
    K -- "نعم عبر إتمام السورة" --> A1
    A1 --> X1["يصفّر last ويعيد رسم القارئ ويرجع true<br/>:957-970"]
    P --> M["إتمام السورة<br/>app.js:310"] --> K
    M --> R["openSurah يعيد الرسم<br/>إلا عند الاكتمال فيتولاه checkKhatmaComplete<br/>:328"]
    P --> Z["ختمة جديدة + نافذة showModal حمراء<br/>app.js:332"] --> Z1{"علّم صندوق الإقرار؟<br/>:340-345"}
    Z1 -- نعم --> Z2["khatmaCount++"]
    Z1 -- لا --> Z3["تصفير بلا احتساب"]
    Z --> Z4["read={} + last=null + saveState + إعادة رسم<br/>:346-352<br/>المسار السليم الوحيد"]
```

## 5. خريطة التخزين

| المفتاح | الكاتب | القارئ | ملاحظة |
|---|---|---|---|
| `quran_tracker_v1.read` | `markAyahRead :118` / `toggleAyahRead :129-131` | `readTotal :95` / `readCountOf :101` | القيمة تاريخ `YYYY-MM-DD` (قديمًا `true`) |
| `...log` | `markAyahRead :120` / `toggleAyahRead :129` | `renderStats :936` | يُخصم من يوم التعليم الأصلي |
| `...last` | `markAyahRead :119` / تصفير جزئي `:131` `:347` `:959` | `createAyahElement :235` / `renderStats :938-940` / `init :1242` | يُصفَّر في الاكتمال والتصفير |
| `...theme` | `toggleTheme :910` | `currentTheme :892-894` + سكربت `index.html:10` | `null` = تلقائي |
| `...lastExportAt` | `exportProgress :594` / استبدال `applyImport :805` | `renderTransferStatus :397` | ISO لآخر نسخة؛ لا يتغير بالدمج |
| `quran_tracker_backup_v1` | `applyImport :816` | `undoImport :836` | نسخة أمان قبل الاستيراد، تُحذف بعد التراجع `:847` |
| `surah_cache_N` | `saveSurahCache :89` | `getCachedAyahs :80` | يُسقط حقل `name` الزائد — سليم |

## 6. المشاكل المنطقية — سجل الإصلاح (رُوجعت 2026-10-13، وأُصلحت جميعها)

| # | الخطورة | الموقع | المشكلة | الإصلاح المطبق |
|---|---|---|---|---|
| A1 | 🔴 عالية | `js/app.js:955-970` | `checkKhatmaComplete` كان يُصفّر دون إعادة رسم القارئ (يبقى أخضر وحالة فارغة) | ✅ يعيد `openSurah(currentSurah)` ويرجع `true`؛ و`completeCurrentSurah` يتخطى رسمه الخاص عندها (`:328`) |
| A2 | 🔴 عالية | `js/app.js:959` | `last` لم يُصفَّر عند الختمة التلقائية | ✅ `state.last = null` |
| B | 🟠 متوسطة | `js/app.js:277` و`:282` | سباق النقرات السريعة (نص سورة تحت عنوان أخرى) | ✅ حارس `currentSurah !== number` بعد كل `await` |
| C | 🟠 متوسطة | `js/app.js:923-925` + `css/style.css:207` و`:267` | `style.fontSize` المباشر كان يقتل `clamp()` على الجوال | ✅ متغير `--reader-size` مع احتياطي مرن |
| D | 🟡 متوسطة UX | `js/app.js:155-156` | البحث العربي حرفي (ابراهيم ≠ إبراهيم) | ✅ `normalizeArabic` للطرفين (`surahMatches :173`) |
| E | 🟢 منخفضة | `js/app.js:1136` | الهدف بلا سقف فعلي رغم `max=500` | ✅ `Math.min(500, ...)` مع رد القيمة للحقل |
| F | 🟢 منخفضة | `js/app.js:934-935` | ‏6236 مكررة يدويًا في HTML | ✅ `aria-valuemax` تُضبط من `TOTAL_AYAS` عند كل رسم |
| G | 🟢 منخفضة | `js/app.js:9` | عتبة `−10` رقم سحري | ✅ ثابت مسمى `KHATMA_RESET_MARGIN` مع تعليل (المنطق الفعلي إقرار صريح في `resetKhatma`) |

ما **ليس** مشكلة (فُحص وتبيّن سليمًا): محاسبة `log` بالخصم من يوم التعليم الأصلي (`:129`)، إسقاط البسملة للسورتين 1 و9 (`:287`)، شكل كاش السور (`:88-91`)، عدم إبراز سورة مُفلترة خارج البحث (محمي بـ `if (!el)` في `:148`)، وعدم وجود ثغرة XSS (لا يُحقن أي مدخل مستخدم في `innerHTML`).

## 7. كيف تقرأ هذا الملف مع الكود

1. ابدأ بالرسم 1 (التدفق العام)، ثم 2 (فتح سورة) مع `openSurah` مفتوحة.
2. تتبع الرسم 3 مع `toggleAyahRead` — كل سهم يقابل سطرًا.
3. الرسم 4 هو خريطة الختمة: كل مسار تصفير وما ينقصه.
4. جدول §6 هو سجل الإصلاح — كل البنود مطبقة وموثقة بمواقعها.

## 8. نقل التقدم: تصدير/استيراد محلي (v2)

قسم مستقل في `js/app.js:355-888` بلا أي شبكة: الملف يُنشئه المتصفح ويُقرأ فيه فقط.
الصيغة الكاملة في `docs/PROGRESS-FILE.md`.

```mermaid
flowchart TD
    E["تصدير نسخة<br/>exportProgress :582"] --> CP["collectProgress :556<br/>app/kind/version/appVersion<br/>exportedAt/exportedAtLocal/timezone<br/>source/device/summary + state.ayahs"]
    CP --> RD["readToAyahs :473<br/>read → قائمة مرتبة + legacy:true"]
    CP --> SU["buildSummary :523<br/>نسبة/متبقٍ/سلسلة أيام/ورد اليوم"]
    CP --> SV["detectSource :420 + detectDevice :430<br/>+ timezoneInfo :408 + localStamp :403"]
    CP --> DL["تنزيل JSON عبر Blob :582-593<br/>noor-progress-YYYY-MM-DD-HHmmss.json"]
    DL --> LE["lastExportAt = exportedAt :594"]

    F["منتقي الملف #importFile"] --> H["handleImportFile :864<br/>سقف 5MB + قراءة"]
    H --> P["parseProgressFile :601<br/>تحقق كامل قبل أي أثر"]
    P -- "إصدار > 2" --> V3["رفض: ملف من نسخة أحدث<br/>:613-615"]
    P -- "ayahs مصفوفة" --> AY["ayahsToRead :485<br/>تحقق صف/عدد/فهرس/تكرار/تاريخ"]
    P -- "v1: read فقط" --> RD1["خريطة read :626-649"]
    AY --> META["meta وصفية :667-685<br/>تصفية + نصوص مقصوصة"]
    RD1 --> META
    P -- "خطأ" --> ERR["showModal برسالة عربية<br/>بلا أي تغيير"]
    META --> PV["showImportPreview :766<br/>معاينة + سطر describeImportMeta :704 + تأكيد"]
    PV --> I{"الوضع"}
    I -- دمج --> MR["mergeRead :728<br/>أقدم تاريخ + mergeLog :740<br/>khatmaCount = max + إعدادات محلية"]
    I -- استبدال --> RP["كل الحقول من الملف<br/>+ lastExportAt = exportedAt :805"]
    MR --> BK["نسخة أمان في<br/>quran_tracker_backup_v1 :816"]
    RP --> BK
    BK --> RF["refreshAfterImport :754<br/>الهدف/الخط/الثيم/الفهرس/الإحصاء/القارئ"]
    RF --> UN["زر تراجع 10 ثوانٍ → undoImport :833"]
```

- **v2 بلا `read`:** ملف v2 يحمل `state.ayahs` قائمة `[{surah, ayah, date}]` مرتبة بالسورة ثم الآية. `read` يبقى شكل التخزين المحلي فقط؛ إن كانت `ayahs` مصفوفة في الملف (داخل `state` أو في الجذر) فهي المرجع ويُتجاهل أي `read` مكرر (`:618-623`).
- **توافق v1:** غياب `ayahs` يعني خريطة `read` بصيغة v1 (`"سورة:آية" → تاريخ | true`)، وتُقبل `true` كما هي (`:642-644`). القيمة `true` في v2 تُصدَّر `{date:null, legacy:true}` (`:478`) وتُستورد `true` مجددًا (`:510-512`).
- **رفض الأحدث:** `Number(root.version) > PROGRESS_FORMAT` تُرفض برسالة «هذا الملف من نسخة أحدث من التطبيق» (`:613-615`) — لا محاولة تفسير صامت.
- **قاعدة الحماية:** `parseProgressFile` لا يبني الحالة بـ spread من الملف؛ `ayahsToRead` تتحقق من كل عنصر (كائن، أعداد صحيحة حقيقية، فهرس، لا تكرار، تاريخ حقيقي لا يتجاوز الغد) وترفض الملف كاملًا عند أول خطأ. وv1 تتحقق من كل مفتاح (`^\d{1,3}:\d{1,3}$`) وكل تاريخ.
- **الوصفي لا يُستورد:** `appVersion` و`exportedAt` و`exportedAtLocal` و`timezone` و`source` و`device` و`summary` للعرض فقط. يُبنى منها `meta` مقصوص (`:667-685`) لسطر المعاينة، ولا تدخل `incoming` (`:687-700`).
- **الدمج آمن للتكرار:** إعادة استيراد الملف نفسه لا تضاعف العدّاد؛ `mergeLog` (سطر 740) يعيد حساب الأيام من تواريخ `read` ثم يأخذ `max` مع المحفوظ والمستورد، فلا ينقص سجل ختمة سابقة.
- **الاستبدال ليس نسخًا أعمى:** `log` يُعاد حسابه من `read` ثم `max` مع `log` الملف (`:799`)، و`lastExportAt` يأتي من `exportedAt` الملف (`:805`).
- **لا ختمة وهمية:** لا يُستدعى `checkKhatmaComplete` بعد الاستيراد لأنه ليس قراءة جديدة.
- **زر التراجع:** يظهر 10 ثوانٍ (`:827-829`)، ويستعيد الحالة السابقة من `quran_tracker_backup_v1`؛ النسخة تبقى بعد انتهاء المهلة حتى استيراد تالٍ. القاعدة `.transfer-undo[hidden]` في `css/style.css:344` ضرورية لأن `.link-quiet` يفرض `display:inline-flex` (`css/style.css:152`).
