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

// يحفظ آيات سورة ([{number, text}]) في localStorage لتعمل دون إنترنت لاحقا، ويحدّث شريط الحالة إن كان ظاهرًا.
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

// يربط كل أزرار الواجهة (الهدف والبحث والتنقل والخط والطي) — يُستدعى مرة واحدة من init.
function bindEvents() {
  $('dailyGoal').textContent = state.dailyGoal;
  $('dailyGoal').setAttribute('aria-valuenow', String(state.dailyGoal));
  const setGoal = (v) => {
    state.dailyGoal = Math.min(500, Math.max(1, v));
    $('dailyGoal').textContent = state.dailyGoal;
    $('dailyGoal').setAttribute('aria-valuenow', String(state.dailyGoal));
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
  updateCacheBar(); // تحديث نص زر الـ footer فقط — لا ظهور تلقائي للشريط.
  try { history.scrollRestoration = 'manual'; window.scrollTo(0, 0); } catch { /* تجاهل */ }
  window.SurahPreloader?.start(state.last?.surah || 1); // التحميل الخلفي لباقي السور (≤1MB/s).
  // لا فتح تلقائي لسورة عند التحميل — المستخدم يختار من الفهرس أو زر المتابعة.
}

init();
