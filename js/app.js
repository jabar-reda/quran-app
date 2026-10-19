// حالة الختمة محفوظة محليا. نفس الشكل دائما حتى لا تنكسر البيانات القديمة.
// ===== الثوابت العامة =====
// TOTAL_AYAS: عدد آيات المصحف كاملا (6236) — أساس حساب نسبة الختمة.
// LS_KEY: مفتاح حالة الختمة في localStorage — لا تغيّر الاسم حتى لا تضيع بيانات المستخدمين.
// CACHE_PREFIX: بادئة مفاتيح نص السور المحفوظة (يليها رقم السورة).
// OFFLINE_SURAHS: السور المضمنة في js/offline-surahs.js للعمل دون إنترنت (تُقرأ من window).
const TOTAL_AYAS = 6236;
// هامش التسامح عند التصفير اليدوي: من بلغ 6226 فأكثر تُحتسب ختمته مكتملة (فارق 10 آيات خلافًا للعدّ).
const KHATMA_RESET_MARGIN = 10;
const LS_KEY = 'quran_tracker_v1';
// مفتاح نسخة الأمان المؤقتة قبل أي استيراد — يعيد الحالة السابقة عند الضغط على «تراجع».
const BACKUP_KEY = 'quran_tracker_backup_v1';
const CACHE_PREFIX = 'surah_cache_';
const OFFLINE_SURAHS = window.OFFLINE_SURAHS || {};

// ===== الحالة العامة =====
// surahs: فهرس السور من data/surahs.json. state: حالة الختمة. currentSurah: السورة المعروضة حاليا.
let surahs = [];
let state = loadState();
let currentSurah = null;

// اختصار getElementById — يقبل id دون #.
const $ = (id) => document.getElementById(id);

// رقم منزلتين بصفر بادئ (07، 14) — أساس كل طوابع التاريخ والوقت.
function pad2(n) {
  return String(n).padStart(2, '0');
}

// مفتاح يوم محلي بصيغة YYYY-MM-DD من كائن Date (توقيت المتصفح لا UTC).
function dateKeyOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// مفتاح سجل اليوم بصيغة YYYY-MM-DD حسب توقيت المتصفح المحلي.
function todayKey() {
  return dateKeyOf(new Date());
}

// يؤجل تنفيذ fn حتى تتوقف الاستدعاءات مدة ms — يستخدم لتقليل إعادة رسم الفهرس أثناء الكتابة في البحث.
function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ===== حفظ الحالة محليا =====
// يقرأ الحالة من localStorage ويدمجها فوق القيم الافتراضية، ليعمل مع البيانات القديمة الناقصة.
// أي حقل جديد يضاف هنا أولا بقيمة افتراضية حتى لا ينكسر ملف مستخدم قديم.
// الحالة الفارغة الافتراضية — مرجع واحد لكل قراءة جديدة (loadState/التراجع عن الاستيراد).
function defaultState() {
  return { read: {}, last: null, khatmaCount: 0, dailyGoal: 20, fontSize: 1.9, log: {}, theme: null, lastExportAt: null };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    return { ...defaultState(), ...saved };
  } catch {
    return defaultState();
  }
}

// يكتب كامل الحالة إلى localStorage — يُستدعى بعد كل تغيير.
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// يجد بيانات سورة من الفهرس برقمها، أو undefined إن لم توجد.
function findSurah(number) {
  return surahs.find((s) => s.number === number);
}

// ===== كاش نص السور =====
// يقرأ آيات سورة من localStorage (حُفظت بعد أول تحميل)، أو null إن لم تُحفظ بعد.
function getCachedAyahs(number) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + number));
    return cached?.ayahs || null;
  } catch {
    return null;
  }
}

// يحفظ آيات سورة ([{number, text}]) في localStorage لتعمل دون إنترنت بعد الحفظ، ويحدّث نص زر الـ footer إن وُجد.
function saveSurahCache(number, ayahs) {
  localStorage.setItem(CACHE_PREFIX + number, JSON.stringify({ ayahs }));
  updateCacheBar();
}

// إجمالي الآيات المقروءة في الختمة الحالية.
function readTotal() {
  return Object.keys(state.read).length;
}

// عدد آيات سورة واحدة مقروءة. القراءة مخزنة كمفاتيح "سورة:آية".
function readCountOf(surahNumber) {
  const prefix = surahNumber + ':';
  return Object.keys(state.read).filter((key) => key.startsWith(prefix)).length;
}

// ===== منطق التعليم والإحصاء =====
// نص حالة السورة في الفهرس: مكتملة (✔) أو جارية (مقروء/كلي) أو لم تبدأ.
function surahStatusText(meta, readCount) {
  const parts = [`${meta.ayahs} آية`, meta.type];
  if (readCount >= meta.ayahs) parts.push('✔');
  else if (readCount > 0) parts.push(`${readCount}/${meta.ayahs}`);
  return parts.join(' • ');
}

// يعلّم آية كمقروءة (إن لم تكن) ويحدّث آخر قراءة وعدّاد اليوم. المفتاح بصيغة "سورة:آية" مثال "18:5".
function markAyahRead(surahNumber, ayahNumber, surahName) {
  const key = `${surahNumber}:${ayahNumber}`;
  if (state.read[key]) return;
  const today = todayKey();
  state.read[key] = today; // نخزن يوم التعليم (نص، وهو truthy) لإنقاص عدّاد اليوم الصحيح عند التراجع.
  state.last = { surah: surahNumber, ayah: ayahNumber, name: surahName };
  state.log[today] = (state.log[today] || 0) + 1;
}

// يبدّل حالة آية: مقروءة ← غير مقروءة (ويصفّر آخر قراءة إن كانت هي) أو العكس.
function toggleAyahRead(surahNumber, ayahNumber, surahName) {
  const key = `${surahNumber}:${ayahNumber}`;
  if (state.read[key]) {
    // إنقاص عدّاد اليوم الذي عُلّمت فيه الآية (القيم القديمة true بلا يوم تُتجاهل).
    const day = state.read[key];
    if (typeof day === 'string' && state.log[day] > 0) state.log[day]--;
    delete state.read[key];
    if (state.last?.surah === surahNumber && state.last?.ayah === ayahNumber) state.last = null;
    return;
  }
  markAyahRead(surahNumber, ayahNumber, surahName);
}

// يحفظ ثم يحدّث الإحصاءات وشارة السورة — يُستدعى بعد كل تعليم/تراجع لآية.
function refreshAyahUI(surahNumber) {
  saveState();
  renderStats();
  updateSurahBadge(surahNumber);
}

// يحدّث نص الشارة وحالة الإنجاز في الفهرس دون إعادة رسم القائمة كاملة.
function updateSurahBadge(surahNumber) {
  const el = document.querySelector(`[data-surah="${surahNumber}"]`);
  const meta = findSurah(surahNumber);
  if (!el || !meta) return;
  const readCount = readCountOf(surahNumber);
  el.querySelector('small').textContent = surahStatusText(meta, readCount);
  el.classList.toggle('done', readCount >= meta.ayahs);
}

// تطبيع البحث العربي: همزات→ا، ة→ه، ى→ي، وحذف التشكيل — حتى يجد «ابراهيم» سورة «إبراهيم».
function normalizeArabic(s) {
  return (s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ٟ]/g, '');
}

// تطبيع الأرقام: مشرقية ٠-٩ وفارسية ۰-۹ إلى لاتينية + تجريد المسافات والأصفار البادئة.
function normalizeDigits(s) {
  const latin = (s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const trimmed = latin.trim();
  return trimmed.replace(/^0+(?=\d)/, '');
}

// مطابقة البحث: الاسم العربي (بعد التطبيع) + الإنجليزي دون حساسية لحالة الأحرف + الرقم بعد تطبيع الأرقام.
function surahMatches(meta, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const nq = normalizeDigits(query);
  const isNumeric = /^\d+$/.test(nq);
  return (
    normalizeArabic(meta.name).includes(normalizeArabic(query)) ||
    meta.english.toLowerCase().includes(q) ||
    (isNumeric && String(meta.number) === nq)
  );
}

// يرسم فهرس السور (مع فلترة) دفعة واحدة عبر DocumentFragment لتقليل إعادة التدفق.
function renderList(filter = '') {
  const box = $('surahList');
  box.textContent = '';
  const query = filter.trim();
  const fragment = document.createDocumentFragment();

  surahs.filter((meta) => surahMatches(meta, query)).forEach((meta) => {
    const readCount = readCountOf(meta.number);
    const done = readCount >= meta.ayahs;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.surah = meta.number;
    button.className = ['surah-item', meta.number === currentSurah && 'active', done && 'done'].filter(Boolean).join(' ');
    button.innerHTML = `<span class="n">${meta.number}</span><span><b>سورة ${meta.name}</b><br><small>${surahStatusText(meta, readCount)}</small></span><span>${done ? '✔' : ''}</span>`;
    button.onclick = () => openSurah(meta.number);
    fragment.appendChild(button);
  });

  box.appendChild(fragment);
}

// يجلب نص السورة بالترتيب: الكاش المحلي ثم السور المضمنة offline ثم API الرسمي (quran-uthmani).
async function loadSurahAyahs(number) {
  const cached = getCachedAyahs(number);
  if (cached) return cached;
  if (OFFLINE_SURAHS[number]) {
    saveSurahCache(number, OFFLINE_SURAHS[number].ayahs);
    return OFFLINE_SURAHS[number].ayahs;
  }
  const response = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
  if (!response.ok) throw new Error(response.status);
  const json = await response.json();
  const ayahs = json.data.ayahs.map((a) => ({ number: a.numberInSurah, text: a.text }));
  saveSurahCache(number, ayahs);
  return ayahs;
}

// يجرّد بادئة البسملة من نص آية («بسم الله الرحمن الرحيم» بأول 4 كلمات بعد حذف التشكيل)
// لأن الـ API يُبقيها في الآية 1 — والعرض الخضراء الزخرفية تكفي. يُستخدم للسور عدا 1 و9 فقط.
function stripBasmalaPrefix(text) {
  const words = String(text).split(/\s+/);
  const head = words.slice(0, 4).join(' ').replace(/ٱ/g, 'ا').replace(/[ً-ٰٟ]/g, '');
  if (head === 'بسم الله الرحمن الرحيم') return words.slice(4).join(' ');
  return text;
}

// يبرز السورة المفتوحة في الفهرس ويزيل التمييز عن غيرها.
function highlightActiveSurah(number) {
  document.querySelectorAll('.surah-item.active').forEach((el) => el.classList.remove('active'));
  document.querySelector(`[data-surah="${number}"]`)?.classList.add('active');
}

// يبني عنصر آية قابلًا للنقر: النقرة تبدّل القراءة وتحدّث التمييز دون إعادة رسم السورة.
function createAyahElement(surahNumber, surahName, ayah) {
  const key = `${surahNumber}:${ayah.number}`;
  const isLast = state.last?.surah === surahNumber && state.last?.ayah === ayah.number;
  const span = document.createElement('span');
  span.className = 'ayah' + (state.read[key] ? ' read' : '') + (isLast && state.read[key] ? ' last' : '');
  span.id = `ayah-${ayah.number}`;
  span.textContent = ayah.text + ' ';
  const badge = document.createElement('span');
  badge.className = 'ayah-num';
  badge.textContent = ayah.number;
  span.appendChild(badge);
  span.appendChild(document.createTextNode(' '));
  span.onclick = () => {
    toggleAyahRead(surahNumber, ayah.number, surahName);
    refreshAyahUI(surahNumber);
    span.classList.toggle('read');
    document.querySelectorAll('.ayah.last').forEach((el) => el.classList.remove('last'));
    if (state.last?.surah === surahNumber) {
      document.getElementById(`ayah-${state.last.ayah}`)?.classList.add('last');
    }
    checkKhatmaComplete();
  };
  return span;
}

// يفتح سورة في القارئ (بالبسملة ما عدا 1 و9) ويمكّن التمرير لآية محددة عند المتابعة.
async function openSurah(number, scrollToAyah = null) {
  currentSurah = number;
  const meta = findSurah(number);
  if (!meta) return;
  $('surahTitle').textContent = `سورة ${meta.name}`;
  $('surahMeta').innerHTML = `<bdi>${meta.english}</bdi> • ${meta.ayahs} آية • ${meta.type}`;
  $('reader').textContent = 'جاري التحميل…';
  highlightActiveSurah(number);

  window.SurahPreloader?.dequeue(number); // لا تُنزّل خلف المستخدم ما يفتحه بنفسه.
  window.SurahPreloader?.userActive(true); // أوقف الخلفي مؤقتًا — أولوية قصوى لهذه السورة.
  const doneBtn = $('completeSurahBtn');
  if (doneBtn) doneBtn.disabled = false;
  let ayahs;
  try {
    ayahs = await loadSurahAyahs(number);
  } catch {
    window.SurahPreloader?.userActive(false);
    if (currentSurah !== number) return; // سباق: المستخدم انتقل لسورة أخرى أثناء الفشل — لا تعرض خطأها عليها.
    $('reader').textContent = 'تعذر تحميل النص (لا يوجد إنترنت ولا نسخة محفوظة). السور المحفوظة محلياً: الفاتحة، الإخلاص، الفلق، الناس. ستعمل باقي السور عند الاتصال بالإنترنت أول مرة ثم تُحفظ.';
    return;
  }
  window.SurahPreloader?.userActive(false); // انتهى جلب المستخدم — استأنف الخلفي أثناء القراءة.
  if (currentSurah !== number) return; // سباق: نقرة أحدث سبقت هذا التحميل — تجاهل النتيجة القديمة.

  const reader = $('reader');
  reader.textContent = '';
  const fragment = document.createDocumentFragment();
  if (number !== 1 && number !== 9) {
    const basmala = document.createElement('div');
    basmala.className = 'basmala';
    basmala.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    fragment.appendChild(basmala);
    // الـ API يُبقي البسملة بادئةً في نص الآية 1 — نجرّدها هنا (نسخة عرض فقط، الكاش سليم) لمنع تكرارها مع الخضراء.
    if (ayahs.length > 0) {
      const stripped = stripBasmalaPrefix(ayahs[0].text);
      if (stripped !== ayahs[0].text) ayahs = [{ ...ayahs[0], text: stripped }, ...ayahs.slice(1)];
    }
  }
  ayahs.forEach((ayah) => fragment.appendChild(createAyahElement(number, meta.name, ayah)));
  reader.appendChild(fragment);

  if (scrollToAyah) {
    setTimeout(() => {
      document.getElementById(`ayah-${scrollToAyah}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

// يعلّم كل آيات السورة الحالية كمقروءة — بعد نافذة تأكيد تعرض عدد الآيات غير المعلّمة.
// لا يفعل شيئًا إن لم تُفتح سورة أو كانت مكتملة أصلًا.
async function completeCurrentSurah() {
  if (!currentSurah) return;
  const meta = findSurah(currentSurah);
  if (!meta) return;
  const ayahs = getCachedAyahs(currentSurah);
  const total = ayahs?.length ?? meta.ayahs;
  const unread = total - readCountOf(currentSurah);
  if (unread <= 0) return;
  const today = state.log[todayKey()] ?? 0;
  const ok = await showModal({
    title: `إتمام سورة ${meta.name}؟`,
    body: `سورة ${meta.name} فيها ${total} آية، قرأت ${total - unread} منها. سيتم تعليم ${unread} آية غير مقروءة دفعة واحدة وإضافتها إلى ورد اليوم (اليوم: ${today} ← ${today + unread}).`,
    confirmText: `نعم، أتمم ${unread} آية`,
  });
  if (!ok) return;
  for (let i = 1; i <= total; i++) markAyahRead(currentSurah, i, meta.name);
  state.last = { surah: currentSurah, ayah: total, name: meta.name };
  refreshAyahUI(currentSurah);
  if (!(await checkKhatmaComplete())) await openSurah(currentSurah); // عند الختمة يعيد checkKhatmaComplete الرسم بنفسه.
}

// يصفّر التقدم لختمة جديدة بعد نافذة تأكيد مخصصة — احتساب الختمة المكتملة يتطلب تعليم الصندوق صراحة.
async function resetKhatma() {
  const total = readTotal();
  const missing = TOTAL_AYAS - total;
  const result = await showModal({
    title: 'بدء ختمة جديدة؟',
    body: total > 0 ? `قرأت ${total} من ${TOTAL_AYAS} آية — ينقصك ${missing} آية للإتمام. سيتم تصفير التقدم الحالي.` : 'لم تبدأ القراءة بعد. لا شيء يُصفَّر.',
    confirmText: 'بدء ختمة جديدة',
    danger: true,
    checkboxLabel: total > 0 && total < TOTAL_AYAS ? `أحتسب هذه ختمة مكتملة رغم نقص ${missing} آية — أقر بأنني واعٍ بذلك` : null,
  });
  const ok = result && typeof result === 'object' ? result.ok : result;
  const checked = result && typeof result === 'object' ? result.checked : false;
  if (!ok) return;
  if (checked) state.khatmaCount++;
  state.read = {};
  state.last = null;
  saveState();
  $('search').value = '';
  renderList();
  renderStats();
  if (currentSurah) openSurah(currentSurah);
}

// ===== نقل التقدم (تصدير/استيراد ملف JSON) =====
// الملف يحمل التقدم والإعدادات مع نسخة صيغة (version) للنقل بين المتصفح والتطبيق أو كنسخة احتياطية.
// v2: الآيات قائمة [{surah, ayah, date}] مرتبة + بيانات وصفية للعرض (summary/source/device/timezone).
const PROGRESS_FORMAT = 2;
// إصدار التطبيق المعلن في الملف — يرفع مع كل إصدار منشور (وصفي فقط، لا يدخل الحالة).
const APP_VERSION = '1.0.0';
const PROGRESS_MAX_BYTES = 5 * 1024 * 1024;
// ترجمة أنواع المصدر في معاينة الاستيراد.
const SOURCE_LABELS = { localhost: 'محلي', web: 'ويب', pwa: 'مثبت', apk: 'APK' };
let pendingImportMode = 'merge'; // الوضع المختار قبل فتح منتقي الملف: merge | replace
let undoTimer = null;

// تاريخ صالح بصيغة YYYY-MM-DD فقط (يرفض 2026-02-31 مثلًا).
function isDayString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isFutureDay(value) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return value > dateKeyOf(tomorrow);
}

// نص «قبل N يوم» بصيغة عربية سليمة لسطر آخر نسخة.
function daysAgoText(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'قبل يوم واحد';
  if (days === 2) return 'قبل يومين';
  if (days <= 10) return `قبل ${days} أيام`;
  return `قبل ${days} يومًا`;
}

// آخر نسخة صدّرها المستخدم من هذا الجهاز (لا يتغير بالاستيراد).
function renderTransferStatus() {
  const el = $('lastExportLine');
  if (!el) return;
  el.textContent = state.lastExportAt
    ? `آخر نسخة: ${daysAgoText(state.lastExportAt)}.`
    : 'لم تصدّر نسخة بعد — صدّر نسخة قبل مسح بيانات المتصفح.';
}

// طابع محلي بصيغة YYYY-MM-DD HH:mm:ss بساعة 24 يدويًا (getHours 0-23) — بلا AM/PM.
function localStamp(date) {
  return `${dateKeyOf(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

// المنطقة الزمنية للجهاز: الاسم من Intl، والإزاحة الحالية بصيغة +03:00 / -04:30 / +00:00.
function timezoneInfo() {
  let iana = 'UTC';
  try {
    iana = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch { iana = 'UTC'; }
  const total = -new Date().getTimezoneOffset(); // بالدقائق، موجب شرق غرينتش.
  const sign = total < 0 ? '-' : '+';
  const abs = Math.abs(total);
  return { iana, offset: `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}` };
}

// مصدر التشغيل: محلي أو ويب أو مثبت PWA أو حزمة APK — وصفي فقط في الملف.
function detectSource() {
  const origin = location.origin;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return { kind: 'localhost', origin };
  if ((document.referrer || '').startsWith('android-app://') || window.Capacitor?.isNativePlatform?.()) return { kind: 'apk', origin };
  if (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true) return { kind: 'pwa', origin };
  return { kind: 'web', origin };
}

// وصف الجهاز من navigator.userAgent فقط (بلا مكتبات كشف) — يُعرض في معاينة الاستيراد ولا يدخل الحالة.
function detectDevice() {
  const ua = navigator.userAgent || '';
  const language = navigator.language || 'ar';

  // المنصة: أندرويد قبل لينكس (يحتويه UA)، وآيفون/آيباد قبل ماك (يحتويه UA كذلك).
  let platform = 'Unknown';
  if (/Android/i.test(ua)) {
    const version = /Android\s+([\d.]+)/i.exec(ua)?.[1];
    platform = version ? `Android ${version}` : 'Android';
  } else if (/iPhone/i.test(ua)) platform = 'iPhone';
  else if (/iPad/i.test(ua)) platform = 'iPad';
  else if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  // الطراز من صيغة أندرويد القياسية «Android …; <MODEL> Build/» — ونستبعد wv لأنه WebView لا طراز.
  let model = '';
  if (platform.startsWith('Android')) {
    const found = /Android[^;]*;\s*(?:[^;)]*;\s*)?([^;)]+?)\s+Build\//i.exec(ua)?.[1]?.trim() || '';
    if (found && !/\bwv\b/i.test(found)) model = found;
  }

  // المتصفح: الترتيب مهم — Edge وOpera يحملان Chrome في الـ UA، وChrome يحمل Safari.
  const major = (hit) => hit[1].split('.')[0];
  const edge = /Edg(?:e|A|iOS)?\/([\d.]+)/i.exec(ua);
  const opera = /(?:OPR|Opera)\/([\d.]+)/i.exec(ua);
  const chrome = /(?:Chrome|CriOS)\/([\d.]+)/i.exec(ua);
  const firefox = /(?:Firefox|FxiOS)\/([\d.]+)/i.exec(ua);
  const safari = /Version\/([\d.]+).*Safari/i.exec(ua);
  let browser = 'Unknown';
  if (edge) browser = `Edge ${major(edge)}`;
  else if (opera) browser = `Opera ${major(opera)}`;
  else if (chrome) browser = `Chrome ${major(chrome)}`;
  else if (firefox) browser = `Firefox ${major(firefox)}`;
  else if (safari) browser = `Safari ${major(safari)}`;
  else if (/Safari/i.test(ua)) browser = 'Safari';

  const label = model ? `${model} • ${platform}` : `${platform} • ${browser}`;
  return { label, platform, model, browser, language };
}

// يحوّل خريطة read المحلية {"18:5": "2026-01-10" | true} إلى قائمة آيات مرتبة بالسورة ثم الآية.
// القيمة true (نسخ قديمة) تصبح date:null مع legacy:true حتى يبقى معناها واضحًا.
function readToAyahs(read) {
  return Object.keys(read || {})
    .map((key) => {
      const [surah, ayah] = key.split(':').map(Number);
      const value = read[key];
      return typeof value === 'string' ? { surah, ayah, date: value } : { surah, ayah, date: null, legacy: true };
    })
    .filter((item) => Number.isInteger(item.surah) && Number.isInteger(item.ayah))
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

// العكس عند الاستيراد: يتحقق من كل عنصر ويبني خريطة read جديدة — لا أثر على الحالة عند أي خطأ.
function ayahsToRead(ayahs) {
  if (!Array.isArray(ayahs)) return { ok: false, error: 'قائمة الآيات في الملف غير صالحة.' };
  if (ayahs.length > TOTAL_AYAS) {
    return { ok: false, error: `الملف يحتوي ${ayahs.length} آية — أكثر من آيات المصحف (${TOTAL_AYAS}).` };
  }
  const read = {};
  const seen = new Set();
  for (const item of ayahs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'عنصر آية في الملف ليس كائنًا صالحًا.' };
    }
    // نطلب أعدادًا حقيقية (لا نصوص رقمية ولا booleans) حتى لا يتحول true إلى 1 بصمت.
    if (typeof item.surah !== 'number' || typeof item.ayah !== 'number' || !Number.isInteger(item.surah) || !Number.isInteger(item.ayah)) {
      return { ok: false, error: 'رقم السورة أو الآية في أحد العناصر ليس عددًا صحيحًا.' };
    }
    const surah = item.surah;
    const ayah = item.ayah;
    const meta = findSurah(surah);
    if (!meta || ayah < 1 || ayah > meta.ayahs) {
      return { ok: false, error: `الآية ${surah}:${ayah} لا تطابق فهرس السور (السورة أو رقم الآية غير موجود).` };
    }
    const key = `${surah}:${ayah}`;
    if (seen.has(key)) return { ok: false, error: `تكرار للآية ${key} في الملف.` };
    seen.add(key);
    const date = item.date;
    if (date === null || date === undefined) {
      read[key] = true; // توافق مع النسخ القديمة: مقروءة بلا تاريخ.
      continue;
    }
    if (typeof date !== 'string') return { ok: false, error: `نوع تاريخ غير صالح للآية ${key}.` };
    if (!isDayString(date)) return { ok: false, error: `تاريخ غير صالح للآية ${key}.` };
    if (isFutureDay(date)) return { ok: false, error: `تاريخ مستقبلي غير مقبول للآية ${key}.` };
    read[key] = date;
  }
  return { ok: true, read };
}

// ملخص وصفي لحظي للختمة (يُحفظ في الملف فقط — لا يُستورد إلى الحالة).
function buildSummary() {
  const total = readTotal();
  const today = todayKey();
  const count = state.log[today] || 0;
  const goal = Number(state.dailyGoal) || 20;
  const days = Object.keys(state.log || {}).filter((day) => (state.log[day] || 0) > 0).sort();

  // الأيام المتتالية: نعدّ من اليوم إن كان فيه قراءة، وإلا من الأمس، ثم نرجع للخلف.
  let streakDays = 0;
  const cursor = new Date();
  if (count <= 0) cursor.setDate(cursor.getDate() - 1);
  while ((state.log[dateKeyOf(cursor)] || 0) > 0) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const completedSurahs = surahs.reduce((n, meta) => n + (readCountOf(meta.number) === meta.ayahs ? 1 : 0), 0);
  return {
    readCount: total,
    totalAyahs: TOTAL_AYAS,
    percent: Math.round((total / TOTAL_AYAS) * 10000) / 100,
    remaining: TOTAL_AYAS - total,
    khatmaCount: state.khatmaCount,
    completedSurahs,
    activeDays: days.length,
    streakDays,
    firstReadDate: days[0] || null,
    today: { date: today, count, goal, remaining: Math.max(0, goal - count), met: count >= goal },
  };
}

// يبني كائن الملف v2 صراحةً (لا spread لحالة غير موثوقة).
// Summary/source/device/timezone أوصاف للعرض فقط — الحالة تبقى في state وحدها.
function collectProgress() {
  const now = new Date();
  return {
    app: 'noor',
    kind: 'progress',
    version: PROGRESS_FORMAT,
    appVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    exportedAtLocal: localStamp(now),
    timezone: timezoneInfo(),
    source: detectSource(),
    device: detectDevice(),
    summary: buildSummary(),
    state: {
      ayahs: readToAyahs(state.read),
      last: state.last,
      khatmaCount: state.khatmaCount,
      dailyGoal: state.dailyGoal,
      fontSize: state.fontSize,
      theme: state.theme,
      log: state.log,
    },
  };
}

// ينزّل نسخة JSON ويحدّث تاريخ آخر تصدير. التنزيل عبر Blob يعمل على الجوال وسطح المكتب.
function exportProgress() {
  const payload = collectProgress();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // الاسم بالوقت المحلي: noor-progress-YYYY-MM-DD-HHmmss.json
  link.download = `noor-progress-${payload.exportedAtLocal.replace(' ', '-').replace(/:/g, '')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  state.lastExportAt = payload.exportedAt;
  saveState();
  renderTransferStatus();
  $('transferStatus').textContent = 'بدأ تنزيل النسخة — احفظها في مكان آمن.';
}

// يتحقق من ملف الاستيراد كاملًا قبل أي لمس للحالة. يرجع {ok:true, incoming, meta} أو {ok:false, error}.
function parseProgressFile(text) {
  let root;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, error: 'الملف ليس JSON صالحًا. اختر ملف النسخة الذي صدّره نور.' };
  }
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return { ok: false, error: 'بنية الملف غير معروفة. اختر ملف نسخة تقدم من نور.' };
  }
  // نقبل ملف النسخة الكامل {state:{…}} أو كائن الحالة الخام {read:…} تسامحًا مع نسخة يدوية.
  const src = root.state && typeof root.state === 'object' && !Array.isArray(root.state) ? root.state : root;
  if (Number(root.version) > PROGRESS_FORMAT) {
    return { ok: false, error: 'هذا الملف من نسخة أحدث من التطبيق. حدّث الصفحة ثم أعد المحاولة.' };
  }

  // v2: قائمة ayahs [{surah, ayah, date}] — إن وُجدت فهي المرجع ويُتجاهل معها أي read مكرر.
  const rawAyahs = Array.isArray(src.ayahs) ? src.ayahs : (Array.isArray(root.ayahs) ? root.ayahs : null);
  let read;
  if (rawAyahs) {
    const converted = ayahsToRead(rawAyahs);
    if (!converted.ok) return { ok: false, error: converted.error };
    read = converted.read;
  } else {
    // v1 (أو كائن حالة خام): خريطة read بمفاتيح "سورة:آية".
    if (!src.read || typeof src.read !== 'object' || Array.isArray(src.read)) {
      return { ok: false, error: 'الملف لا يحتوي بيانات قراءة صالحة (ayahs أو read).' };
    }
    const entries = Object.entries(src.read);
    if (entries.length > TOTAL_AYAS) {
      return { ok: false, error: `الملف يحتوي ${entries.length} آية — أكثر من آيات المصحف (${TOTAL_AYAS}).` };
    }
    read = {};
    for (const [key, value] of entries) {
      const match = /^(\d{1,3}):(\d{1,3})$/.exec(key);
      if (!match) return { ok: false, error: `مفتاح آية غير صالح في الملف: ${key}` };
      const meta = findSurah(Number(match[1]));
      const ayah = Number(match[2]);
      if (!meta || ayah < 1 || ayah > meta.ayahs) {
        return { ok: false, error: `الآية ${key} لا تطابق فهرس السور (السورة أو رقم الآية غير موجود).` };
      }
      if (value === true) {
        read[key] = true; // توافق مع النسخ القديمة: مقروءة بلا تاريخ.
        continue;
      }
      if (!isDayString(value)) return { ok: false, error: `تاريخ غير صالح للآية ${key}.` };
      if (isFutureDay(value)) return { ok: false, error: `تاريخ مستقبلي غير مقبول للآية ${key}.` };
      read[key] = value;
    }
  }

  let last = null;
  if (src.last && typeof src.last === 'object') {
    const meta = findSurah(Number(src.last.surah));
    const ayah = Number(src.last.ayah);
    if (!meta || !Number.isInteger(ayah) || ayah < 1 || ayah > meta.ayahs) {
      return { ok: false, error: 'موضع آخر قراءة في الملف غير صالح.' };
    }
    last = { surah: meta.number, ayah, name: meta.name };
  }

  const goal = Number(src.dailyGoal);
  const size = Number(src.fontSize);
  // تاريخ التصدير في غلاف الملف، ونتسامح مع وجوده داخل كائن الحالة في النسخ اليدوية.
  const exported = Date.parse(root.exportedAt ?? src.exportedAt);

  // البيانات الوصفية للعرض فقط (لا تدخل الحالة): نصوص مقصوصة ونوع مصدر من قائمة مسموحة.
  const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
  const kind = typeof root.source?.kind === 'string' ? root.source.kind : '';
  const sourceKind = Object.prototype.hasOwnProperty.call(SOURCE_LABELS, kind) ? kind : '';
  const source = sourceKind
    ? { kind: sourceKind, origin: clip(root.source?.origin, 200) }
    : null;
  const dev = root.device && typeof root.device === 'object' && !Array.isArray(root.device) ? root.device : null;
  const device = dev
    ? { label: clip(dev.label, 80), platform: clip(dev.platform, 40), model: clip(dev.model, 40), browser: clip(dev.browser, 40), language: clip(dev.language, 24) }
    : null;
  const meta = {
    version: Number.isFinite(Number(root.version)) ? Number(root.version) : 1,
    appVersion: clip(root.appVersion, 24),
    exportedAt: clip(root.exportedAt, 40),
    exportedAtLocal: clip(root.exportedAtLocal, 32),
    source,
    device,
  };

  return {
    ok: true,
    incoming: {
      read,
      last,
      khatmaCount: Number.isInteger(src.khatmaCount) && src.khatmaCount >= 0 ? src.khatmaCount : 0,
      dailyGoal: Number.isFinite(goal) ? Math.min(500, Math.max(1, Math.round(goal))) : 20,
      fontSize: Number.isFinite(size) ? Math.min(3, Math.max(1.2, size)) : 1.9,
      theme: src.theme === 'dark' || src.theme === 'light' ? src.theme : null,
      log: sanitizeLog(src.log),
      exportedAt: Number.isFinite(exported) ? new Date(exported).toISOString() : null,
    },
    meta,
  };
}

// سطر وصفي في معاينة الاستيراد: من أي جهاز أُنشئ الملف ومتى — تُحذف الأجزاء الغائبة بهدوء.
function describeImportMeta(meta) {
  if (!meta) return '';
  const kind = meta.source?.kind && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, meta.source.kind) ? SOURCE_LABELS[meta.source.kind] : '';
  const device = meta.device?.label || '';
  const from = device ? `${device}${kind ? ` (${kind})` : ''}` : kind;
  const line = [from ? `الملف من: ${from}` : '', meta.exportedAtLocal ? `أُنشئ: ${meta.exportedAtLocal}` : '']
    .filter(Boolean)
    .join(' — ');
  return line ? `${line}. ` : '';
}

// سجل الأيام: يحتفظ فقط بالتواريخ الصالحة والأعداد الصحيحة غير السالبة (السجل النهائي يعاد حسابه في mergeLog).
function sanitizeLog(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const [day, count] of Object.entries(raw)) {
    if (!isDayString(day) || isFutureDay(day)) continue;
    const n = Number(count);
    if (Number.isInteger(n) && n >= 0 && n <= TOTAL_AYAS) clean[day] = n;
  }
  return clean;
}

// اتحاد الآيات: عند تعارض المفتاح يبقى أقدم تاريخ (أول تعليم)، والنسخة القديمة true تُستبدل بأي تاريخ.
function mergeRead(localRead, incomingRead) {
  const merged = { ...localRead };
  for (const [key, day] of Object.entries(incomingRead)) {
    const current = merged[key];
    if (current === undefined) merged[key] = day;
    else if (typeof current !== 'string' && typeof day === 'string') merged[key] = day;
    else if (typeof current === 'string' && typeof day === 'string' && day < current) merged[key] = day;
  }
  return merged;
}

// سجل الأيام بعد الدمج: يُحسب من تواريخ الآيات الحالية، ثم لا ينقص ما كان محفوظًا سابقًا (يحفظ تاريخ الختمات الماضية).
function mergeLog(localLog, importedLog, read) {
  const recomputed = {};
  Object.values(read).forEach((day) => {
    if (typeof day === 'string') recomputed[day] = (recomputed[day] || 0) + 1;
  });
  const days = new Set([...Object.keys(localLog || {}), ...Object.keys(importedLog || {}), ...Object.keys(recomputed)]);
  const merged = {};
  days.forEach((day) => {
    merged[day] = Math.max(localLog?.[day] || 0, importedLog?.[day] || 0, recomputed[day] || 0);
  });
  return merged;
}

// يجدد الواجهة بعد استيراد/تراجع: كل ما يعتمد على الحالة (الإحصاءات/الفهرس/الخط/الثيم/القارئ المفتوح).
function refreshAfterImport() {
  applyGoalUI();
  applyReaderFontSize();
  applyTheme();
  renderList();
  renderStats();
  renderTransferStatus();
  if (currentSurah) openSurah(currentSurah);
}

// يعرض معاينة الملف (عدد الآيات والأثر) قبل التطبيق — الاستبدال يمرّر danger فلا يُلغى بالنقر خارجها.
// meta وصفية من الملف (الجهاز/تاريخ الإنشاء) تُعرض سطرًا أول المعاينة، ولا تدخل الحالة.
async function showImportPreview(incoming, mode, meta = null) {
  const total = Object.keys(incoming.read).length;
  const percent = ((total / TOTAL_AYAS) * 100).toFixed(2);
  const localTotal = readTotal();
  const added = Object.keys(incoming.read).filter((key) => !(key in state.read)).length;
  const lastLine = incoming.last
    ? ` موضع التوقف في الملف: سورة ${incoming.last.name} آية ${incoming.last.ayah}.`
    : ' لا يوجد موضع توقف في الملف.';
  const metaLine = describeImportMeta(meta);
  const body =
    metaLine +
    (mode === 'replace'
      ? `الملف يحتوي ${total} آية (${percent}%) وختمات مكتملة: ${incoming.khatmaCount}. سيُستبدل تقدمك الحالي (${localTotal} آية) بما في الملف، وتُطبَّق إعداداته.${lastLine}`
      : `الملف يحتوي ${total} آية (${percent}%) وختمات مكتملة: ${incoming.khatmaCount}. الدمج سيضيف ${added} آية جديدة إلى تقدمك الحالي (${localTotal} آية) دون حذف شيء.`);
  const ok = await showModal({
    title: mode === 'replace' ? 'استبدال التقدم من ملف؟' : 'دمج التقدم من ملف؟',
    body,
    confirmText: mode === 'replace' ? 'نعم، استبدل' : 'نعم، ادمج',
    danger: mode === 'replace',
  });
  if (!ok) return;
  applyImport(incoming, mode);
}

// يطبّق الاستيراد: يحفظ نسخة أمان من الحالة السابقة ثم يدمج أو يستبدل ويعرض زر تراجع لمدة 10 ثوانٍ.
function applyImport(incoming, mode) {
  const before = JSON.parse(JSON.stringify(state));
  const replace = mode === 'replace';
  const mergedRead = replace ? incoming.read : mergeRead(state.read, incoming.read);
  const next = replace
    ? {
        ...state,
        read: incoming.read,
        log: mergeLog({}, incoming.log, incoming.read),
        khatmaCount: incoming.khatmaCount,
        last: incoming.last,
        dailyGoal: incoming.dailyGoal,
        fontSize: incoming.fontSize,
        theme: incoming.theme,
        lastExportAt: incoming.exportedAt,
      }
    : {
        ...state,
        read: mergedRead,
        log: mergeLog(state.log, incoming.log, mergedRead),
        khatmaCount: Math.max(state.khatmaCount, incoming.khatmaCount),
        last: state.last || incoming.last,
      };
  const added = Object.keys(next.read).filter((key) => !(key in state.read)).length;
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state: before }));
  } catch { /* التخزين ممتلئ — نكمل بلا نسخة تراجع بدل إفشال الاستيراد. */ }
  state = next;
  saveState();
  refreshAfterImport();
  $('transferStatus').textContent = replace
    ? 'تم استبدال التقدم من الملف.'
    : `تم الدمج — أُضيفت ${added} آية جديدة.`;
  const undoBtn = $('undoImportBtn');
  if (undoBtn) undoBtn.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    if (undoBtn) undoBtn.hidden = true;
  }, 10000);
}

// يرجع الحالة التي كانت قبل آخر استيراد (النسخة تبقى في localStorage حتى استيراد تالٍ).
function undoImport() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (!saved?.state) {
    $('transferStatus').textContent = 'لا توجد نسخة سابقة للتراجع.';
    $('undoImportBtn').hidden = true;
    return;
  }
  state = { ...defaultState(), ...saved.state };
  saveState();
  localStorage.removeItem(BACKUP_KEY);
  clearTimeout(undoTimer);
  $('undoImportBtn').hidden = true;
  refreshAfterImport();
  $('transferStatus').textContent = 'تم التراجع عن الاستيراد.';
}

// يفتح منتقي الملف بالوضع المحدد (merge/replace) — الحدث نفسه يقرأ الملف ويعرض المعاينة.
function pickImportFile(mode) {
  pendingImportMode = mode;
  const input = $('importFile');
  if (!input) return;
  input.value = '';
  input.click();
}

// يقرأ الملف المختار ويتحقق منه ثم يعرض المعاينة. أي فشل يظهر في نافذة واحدة بلا أثر على الحالة.
async function handleImportFile(file) {
  if (!file) return;
  if (file.size > PROGRESS_MAX_BYTES) {
    await showModal({
      title: 'الملف كبير جدًا',
      body: 'الحجم الأقصى 5 ميغابايت. تأكد أنك اخترت ملف نسخة تقدم نور وليس ملفًا آخر.',
      confirmText: 'حسنًا',
      single: true,
    });
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    await showModal({ title: 'تعذر قراءة الملف', body: 'لم نتمكن من فتح الملف. أعد اختياره من مكانه الأصلي.', confirmText: 'حسنًا', single: true });
    return;
  }
  const parsed = parseProgressFile(text);
  if (!parsed.ok) {
    await showModal({ title: 'تعذر الاستيراد', body: parsed.error, confirmText: 'حسنًا', single: true });
    return;
  }
  await showImportPreview(parsed.incoming, pendingImportMode, parsed.meta);
}

// ===== الوضع الليلي =====
// الثيم الفعلي: محفوظ (dark/light) أو تلقائي حسب النظام عندما theme ‏=== null.
function currentTheme() {
  if (state.theme === 'dark' || state.theme === 'light') return state.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// يطبّق الثيم عبر data-theme على html ويحدّث أيقونة الزر وحالته لقارئ الشاشة.
function applyTheme() {
  const dark = currentTheme() === 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else document.documentElement.removeAttribute('data-theme');
  const btn = $('themeToggle');
  if (!btn) return;
  btn.textContent = dark ? '☀' : '☾';
  btn.setAttribute('aria-pressed', String(dark));
}

// يبدّل ليلي/نهاري صراحة ويحفظ الاختيار (يلغي التلقائي).
function toggleTheme() {
  state.theme = currentTheme() === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
}

// يغيّر حجم خط القارئ ضمن حدّي 1.2 و3 rem ويحفظه في الحالة.
function changeFontSize(step) {
  state.fontSize = Math.min(3, Math.max(1.2, (state.fontSize || 1.9) + step));
  saveState();
  applyReaderFontSize();
}

// حجم خط القارئ عبر متغير CSS (لا style مباشر) حتى لا يقتل clamp() المتجاوب على الجوال.
function applyReaderFontSize() {
  $('reader').style.setProperty('--reader-size', (state.fontSize || 1.9) + 'rem');
}

// يحدّث لوحة الختمة: النسبة والشريط (مع aria-valuenow) وورد اليوم وآخر قراءة.
function renderStats() {
  const total = readTotal();
  const percent = (total / TOTAL_AYAS) * 100;
  $('percent').textContent = percent.toFixed(2) + '%';
  $('statsLine').textContent = `${total} / ${TOTAL_AYAS} آية • المتبقي ${TOTAL_AYAS - total}`;
  $('progressFill').style.width = percent + '%';
  $('khatmaProgress')?.setAttribute('aria-valuenow', String(total));
  $('khatmaProgress')?.setAttribute('aria-valuemax', String(TOTAL_AYAS));
  $('todayCount').textContent = `اليوم: ${state.log[todayKey()] ?? 0} / ${state.dailyGoal}`;
  $('khatmaCount').textContent = `ختمات مكتملة: ${state.khatmaCount}`;
  if (state.last) {
    $('continueBtn').textContent = `تابع: ${state.last.name} آية ${state.last.ayah}`;
    $('lastReadLine').textContent = `آخر قراءة: سورة ${state.last.name} — آية ${state.last.ayah}`;
  } else {
    $('continueBtn').textContent = 'تابع القراءة';
    $('lastReadLine').textContent = 'لم تبدأ بعد — اختر سورة من الفهرس';
  }
  /* شريط المتابعة اللاصق (يظهر على الجوال فقط): النص + عرض التعبئة عبر ‎--p على العنصر نفسه */
  const strip = $('trackStrip');
  if (strip) {
    if ($('stripToday')) $('stripToday').textContent = `اليوم: ${state.log[todayKey()] ?? 0} / ${state.dailyGoal}`;
    if ($('stripPercent')) $('stripPercent').textContent = percent.toFixed(2) + '%';
    strip.style.setProperty('--p', percent + '%');
  }
}

// عند بلوغ 6236 يعرض نافذة تهنئة مخصصة ثم يصفّر التقدم وآخر قراءة ويعيد رسم القارئ. يرجع true إن اكتملت ختمة.
async function checkKhatmaComplete() {
  if (readTotal() < TOTAL_AYAS) return false;
  state.khatmaCount++;
  state.read = {};
  state.last = null;
  saveState();
  renderStats();
  renderList();
  if (currentSurah) openSurah(currentSurah);
  await showModal({
    title: 'ما شاء الله! أتممت الختمة',
    body: `تقبل الله منك — ختماتك المكتملة: ${state.khatmaCount}. بدأت ختمة جديدة تلقائيًا.`,
    confirmText: 'تقبل الله — متابعة',
    single: true,
  });
  return true;
}

// ===== النوافذ المخصصة (بدل alert/confirm الأصليين) =====
// نافذة واحدة لكل الاستخدامات: تأكيد خطر (زر أحمر + تراجع) أو إشعار بزر واحد.
// ترجع Promise<boolean> عادة، أو Promise<{ok, checked}> عند تمرير checkboxLabel.
// حبس تركيز + Esc + إعادة التركيز للفاتح.
function showModal({ title, body, confirmText = 'تأكيد', danger = false, single = false, checkboxLabel = null }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const card = document.createElement('div');
    card.className = 'modal-card';
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    const h = document.createElement('h2');
    h.id = 'modalTitle';
    h.textContent = title;
    card.setAttribute('aria-labelledby', 'modalTitle');
    const p = document.createElement('p');
    p.id = 'modalDesc';
    p.textContent = body;
    card.setAttribute('aria-describedby', 'modalDesc');
    card.append(h, p);
    let box = null;
    if (checkboxLabel) {
      const label = document.createElement('label');
      label.className = 'modal-check';
      box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = false;
      const span = document.createElement('span');
      span.textContent = checkboxLabel;
      label.append(box, span);
      card.appendChild(label);
    }
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = confirmText;
    ok.className = danger ? 'btn-danger' : 'btn-primary';
    actions.appendChild(ok);
    let cancel = null;
    if (!single) {
      cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'تراجع';
      cancel.className = 'btn-quiet';
      actions.appendChild(cancel);
    }
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = (value) => {
      document.body.style.overflow = '';
      overlay.remove();
      if (prevFocus?.focus) prevFocus.focus();
      resolve(checkboxLabel ? { ok: value, checked: box?.checked === true } : value);
    };
    // عند وجود صندوق إقرار: زر التأكيد معطّل وباهت حتى يعلّم المستخدم الصندوق (كقبول سياسة الخصوصية).
    if (checkboxLabel && box) {
      ok.disabled = true;
      box.addEventListener('change', () => { ok.disabled = !box.checked; });
    }
    ok.onclick = () => close(true);
    cancel && (cancel.onclick = () => close(false));
    if (!danger) overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(false); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key !== 'Tab') return;
      const focusables = [...card.querySelectorAll('button, input[type="checkbox"]')];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    (danger ? cancel || ok : ok).focus();
  });
}

// ===== شريط حالة السور المحفوظة (يدوي فقط بزر الـ footer، ويختفي بعد 5 ثوانٍ) =====
let cacheBarTimer = null;

// عدد السور المحفوظة في localStorage (فحص متزامن سريع).
function cachedSurahCount() {
  let n = 0;
  for (let i = 1; i <= 114; i++) {
    try {
      if (localStorage.getItem(CACHE_PREFIX + i)) n++;
    } catch { break; }
  }
  return n;
}

function updateCacheBar() {
  const n = cachedSurahCount();
  const btn = $('cacheBarBtn');
  if (btn) btn.textContent = `السور المحفوظة: ${n} / 114`;
  const bar = $('cacheBar');
  if (!bar) return;
  bar.querySelector('.cache-text').textContent = `السور المحفوظة محليًا: ${n} / 114`;
  bar.querySelector('.cache-fill').style.inlineSize = `${(n / 114) * 100}%`;
}

function hideCacheBar() {
  clearTimeout(cacheBarTimer);
  cacheBarTimer = null;
  $('cacheBar')?.remove();
}

function showCacheBar() {
  hideCacheBar();
  const bar = document.createElement('div');
  bar.id = 'cacheBar';
  bar.className = 'cache-bar';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'cache-text';
  text.textContent = 'يفحص النسخ المحفوظة…';
  const track = document.createElement('span');
  track.className = 'cache-track';
  const fill = document.createElement('span');
  fill.className = 'cache-fill';
  track.appendChild(fill);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cache-close';
  close.setAttribute('aria-label', 'إغلاق شريط حالة التحميل');
  close.textContent = '✕';
  close.onclick = hideCacheBar;
  bar.append(text, track, close);
  document.body.appendChild(bar);
  updateCacheBar();
  cacheBarTimer = setTimeout(hideCacheBar, 5000);
}

// يحدّث شارة الاتصال: مخفية عند الاتصال، ظاهرة فقط دون إنترنت.
function updateNetStatus() {
  const pill = $('netStatus');
  if (!pill) return;
  if (navigator.onLine) {
    pill.hidden = true;
    pill.classList.remove('offline');
  } else {
    pill.hidden = false;
    pill.textContent = 'أنت تعمل الآن دون اتصال — السور المحفوظة فقط متاحة.';
    pill.classList.add('offline');
  }
}

// يزامن عدّاد الهدف الظاهر مع الحالة (يُستدعى بعد الاستيراد أيضًا، لا في bindEvents فقط).
function applyGoalUI() {
  const el = $('dailyGoal');
  if (!el) return;
  el.textContent = state.dailyGoal;
  el.setAttribute('aria-valuenow', String(state.dailyGoal));
}

// يربط كل أزرار الواجهة (الهدف والبحث والتنقل والخط والطي) — يُستدعى مرة واحدة من init.
function bindEvents() {
  applyGoalUI();
  const setGoal = (v) => {
    state.dailyGoal = Math.min(500, Math.max(1, v));
    applyGoalUI();
    saveState();
    renderStats();
  };
  $('goalUp').addEventListener('click', () => setGoal(state.dailyGoal + 1));
  $('goalDown').addEventListener('click', () => setGoal(state.dailyGoal - 1));
  $('dailyGoal').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setGoal(state.dailyGoal + 1); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setGoal(state.dailyGoal - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setGoal(1); }
    else if (e.key === 'End') { e.preventDefault(); setGoal(500); }
  });
  $('search').addEventListener('input', debounce((e) => renderList(e.target.value)));
  document.querySelectorAll('[data-goto]').forEach((b) => {
    b.addEventListener('click', () => openSurah(+b.dataset.goto));
  });
  $('continueBtn').addEventListener('click', () => {
    if (state.last) openSurah(state.last.surah, state.last.ayah);
    else openSurah(1);
  });
  $('resetBtn').addEventListener('click', resetKhatma);
  $('cacheBarBtn')?.addEventListener('click', showCacheBar);
  // نقل التقدم: تصدير/استيراد ملف محلي فقط — لا شبكة ولا رفع بيانات.
  $('exportBtn')?.addEventListener('click', exportProgress);
  $('importMergeBtn')?.addEventListener('click', () => pickImportFile('merge'));
  $('importReplaceBtn')?.addEventListener('click', () => pickImportFile('replace'));
  $('importFile')?.addEventListener('change', (e) => handleImportFile(e.target.files?.[0]));
  $('undoImportBtn')?.addEventListener('click', undoImport);
  // شارة الاتصال: تحديث فوري عند التبدل بين متصل/غير متصل.
  updateNetStatus();
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  // تقدّم التحميل الخلفي يُحدّث شريط الحالة حيًا.
  window.addEventListener('surah-cache-progress', updateCacheBar);
  $('fontPlus').addEventListener('click', () => changeFontSize(0.15));
  $('fontMinus').addEventListener('click', () => changeFontSize(-0.15));
  $('themeToggle').addEventListener('click', toggleTheme);
  // تتبع تبدل ثيم النظام فقط في الوضع التلقائي (theme ‏=== null).
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!state.theme) applyTheme();
  });
  $('completeSurahBtn').addEventListener('click', completeCurrentSurah);
  $('prevSurah').addEventListener('click', () => {
    if (currentSurah > 1) openSurah(currentSurah - 1);
  });
  $('nextSurah').addEventListener('click', () => {
    if (currentSurah < 114) openSurah(currentSurah + 1);
  });
  $('indexToggle')?.addEventListener('click', () => {
    const nav = document.querySelector('.index');
    const collapsed = nav.classList.toggle('collapsed');
    const btn = $('indexToggle');
    btn.textContent = collapsed ? 'عرض' : 'طي';
    btn.setAttribute('aria-expanded', String(!collapsed));
  });
}

// آية اليوم: اختيار حتمي من data/daily.json حسب يوم السنة — يعمل دون إنترنت بعد أول تحميل.
async function renderDaily() {
  try {
    const response = await fetch('data/daily.json');
    if (!response.ok) throw new Error(response.status);
    const data = await response.json();
    const list = Array.isArray(data) ? data : data?.daily;
    if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
    const now = new Date();
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const item = list[day % list.length];
    if (!item?.text) throw new Error('bad-item');
    $('dailyText').textContent = item.text;
    $('dailyRef').textContent = item.ref ? `سورة ${item.ref}` : '';
  } catch {
    $('dailyText').textContent = 'تعذر تحميل آية اليوم.';
    $('dailyRef').textContent = '';
  }
}

// نقطة الدخول: يحمّل الفهرس من data/surahs.json ثم يرسم القائمة والإحصاءات وآية اليوم.
// ملاحظة: يحتاج خادمًا محليًا لأن fetch يُحجب ببروتوكول file:// في بعض المتصفحات.
async function init() {
  try {
    const response = await fetch('data/surahs.json');
    if (!response.ok) throw new Error(response.status);
    surahs = await response.json();
  } catch {
    $('surahList').textContent = 'تعذر تحميل فهرس السور.';
    return;
  }
  bindEvents();
  applyTheme(); // قبل رسم القارئ لتقليل وميض الثيم الخاطئ.
  renderList();
  renderStats();
  applyReaderFontSize();
  renderDaily(); // لا ننتظرها — بطاقة صغيرة لا تمنع التفاعل.
  updateCacheBar(); // تحديث نص زر الـ footer فقط — لا ظهور تلقائي للشريط.
  renderTransferStatus(); // سطر «آخر نسخة» في بطاقة نقل التقدم.
  // تخزين دائم: نطلب من المتصفح عدم إخلاء تقدم المستخدم عند ضغط التخزين (يُتجاهل بصمت حيث لا يُدعم).
  if (navigator.storage?.persisted) {
    navigator.storage.persisted()
      .then((persisted) => { if (!persisted) return navigator.storage.persist?.(); })
      .catch(() => {});
  }
  try { history.scrollRestoration = 'manual'; window.scrollTo(0, 0); } catch { /* تجاهل */ }
  // التحميل الخلفي لباقي السور (≤1MB/s) — بعد اكتمال تحميل الصفحة بثانيتين حتى لا يزاحم أول رسم (إقلاع أسرع على الجوال).
  // التأخير آمن: فتح المستخدم لسورة يجلِبها مباشرة ويُخرجها من الطابور قبل بدئه (dequeue + تخطي المحفوظ في buildQueue).
  const startPreload = () => window.SurahPreloader?.start(state.last?.surah || 1);
  if (document.readyState === 'complete') setTimeout(startPreload, 2000);
  else window.addEventListener('load', () => setTimeout(startPreload, 2000), { once: true });
  // سنة الحقوق في التذييل (القيمة في HTML احتياط لتعطّل JS).
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  // لا فتح تلقائي لسورة عند التحميل — المستخدم يختار من الفهرس أو زر المتابعة.
}

init();
