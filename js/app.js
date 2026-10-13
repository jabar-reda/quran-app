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
const CACHE_PREFIX = 'surah_cache_';
const OFFLINE_SURAHS = window.OFFLINE_SURAHS || {};

// ===== الحالة العامة =====
// surahs: فهرس السور من data/surahs.json. state: حالة الختمة. currentSurah: السورة المعروضة حاليا.
let surahs = [];
let state = loadState();
let currentSurah = null;

// اختصار getElementById — يقبل id دون #.
const $ = (id) => document.getElementById(id);

// مفتاح سجل اليوم بصيغة YYYY-MM-DD حسب توقيت المتصفح المحلي.
function todayKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
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
function loadState() {
  const empty = { read: {}, last: null, khatmaCount: 0, dailyGoal: 20, fontSize: 1.9, log: {}, theme: null };
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    return { ...empty, ...saved };
  } catch {
    return empty;
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

// يحفظ آيات سورة ([{number, text}]) في localStorage لتعمل دون إنترنت لاحقا.
function saveSurahCache(number, ayahs) {
  localStorage.setItem(CACHE_PREFIX + number, JSON.stringify({ ayahs }));
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

// مطابقة البحث: الاسم العربي (بعد التطبيع) + الإنجليزي دون حساسية لحالة الأحرف + الرقم مطابقًا تمامًا.
function surahMatches(meta, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    normalizeArabic(meta.name).includes(normalizeArabic(query)) ||
    meta.english.toLowerCase().includes(q) ||
    String(meta.number) === query
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
  $('reader').textContent = 'جاري التحميل...';
  highlightActiveSurah(number);

  let ayahs;
  try {
    ayahs = await loadSurahAyahs(number);
  } catch {
    if (currentSurah !== number) return; // سباق: المستخدم انتقل لسورة أخرى أثناء الفشل — لا تعرض خطأها عليها.
    $('reader').textContent = 'تعذر تحميل النص (لا يوجد إنترنت ولا نسخة محفوظة). السور المحفوظة محلياً: الفاتحة، الإخلاص، الفلق، الناس. ستعمل باقي السور عند الاتصال بالإنترنت أول مرة ثم تُحفظ.';
    return;
  }
  if (currentSurah !== number) return; // سباق: نقرة أحدث سبقت هذا التحميل — تجاهل النتيجة القديمة.

  const reader = $('reader');
  reader.textContent = '';
  const fragment = document.createDocumentFragment();
  if (number !== 1 && number !== 9) {
    const basmala = document.createElement('div');
    basmala.className = 'basmala';
    basmala.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    fragment.appendChild(basmala);
  }
  ayahs.forEach((ayah) => fragment.appendChild(createAyahElement(number, meta.name, ayah)));
  reader.appendChild(fragment);

  if (scrollToAyah) {
    setTimeout(() => {
      document.getElementById(`ayah-${scrollToAyah}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

// يعلّم كل آيات السورة الحالية كمقروءة (من الكاش أو عدد الفهرس) ثم يعيد رسمها.
async function completeCurrentSurah() {
  if (!currentSurah) return;
  const meta = findSurah(currentSurah);
  if (!meta) return;
  const ayahs = getCachedAyahs(currentSurah);
  const total = ayahs?.length ?? meta.ayahs;
  for (let i = 1; i <= total; i++) markAyahRead(currentSurah, i, meta.name);
  state.last = { surah: currentSurah, ayah: total, name: meta.name };
  refreshAyahUI(currentSurah);
  if (!checkKhatmaComplete()) await openSurah(currentSurah); // عند الختمة يعيد checkKhatmaComplete الرسم بنفسه.
}

// يصفّر التقدم لختمة جديدة بعد confirm — يحتسب ختمة مكتملة إن كان المقروء ضمن هامش KHATMA_RESET_MARGIN.
function resetKhatma() {
  if (!confirm('هل تريد بدء ختمة جديدة؟ سيتم تصفير التقدم الحالي.')) return;
  if (readTotal() >= TOTAL_AYAS - KHATMA_RESET_MARGIN) state.khatmaCount++;
  state.read = {};
  state.last = null;
  saveState();
  $('search').value = '';
  renderList();
  renderStats();
  if (currentSurah) openSurah(currentSurah);
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
}

// عند بلوغ 6236 يعرض تنبيهًا ثم يصفّر التقدم وآخر قراءة ويعيد رسم القارئ. يرجع true إن اكتملت ختمة.
function checkKhatmaComplete() {
  if (readTotal() < TOTAL_AYAS) return false;
  alert('ما شاء الله! أتممت الختمة. تقبل الله منك.');
  state.khatmaCount++;
  state.read = {};
  state.last = null;
  saveState();
  renderStats();
  renderList();
  if (currentSurah) openSurah(currentSurah);
  return true;
}

// يربط كل أزرار الواجهة (الهدف والبحث والتنقل والخط والطي) — يُستدعى مرة واحدة من init.
function bindEvents() {
  $('dailyGoal').value = state.dailyGoal;
  $('dailyGoal').addEventListener('change', (e) => {
    state.dailyGoal = Math.min(500, Math.max(1, parseInt(e.target.value) || 20));
    e.target.value = state.dailyGoal;
    saveState();
    renderStats();
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

// نقطة الدخول: يحمّل الفهرس من data/surahs.json ثم يرسم القائمة والإحصاءات ويفتح آخر قراءة.
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
  openSurah(state.last?.surah || 1, state.last?.ayah);
}

init();
