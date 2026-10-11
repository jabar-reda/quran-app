// حالة الختمة محفوظة محليا. نفس الشكل دائما حتى لا تنكسر البيانات القديمة.
const TOTAL_AYAS = 6236;
const LS_KEY = 'quran_tracker_v1';
const CACHE_PREFIX = 'surah_cache_';
const OFFLINE_SURAHS = window.OFFLINE_SURAHS || {};

let surahs = [];
let state = loadState();
let currentSurah = null;
let fontSize = state.fontSize || 1.9;

const $ = (id) => document.getElementById(id);

function todayKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function loadState() {
  const empty = { read: {}, last: null, khatmaCount: 0, dailyGoal: 20, fontSize: 1.9, log: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    return { ...empty, ...saved };
  } catch {
    return empty;
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function findSurah(number) {
  return surahs.find((s) => s.number === number);
}

function getCachedAyahs(number) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + number));
    return cached?.ayahs || null;
  } catch {
    return null;
  }
}

function saveSurahCache(number, ayahs) {
  localStorage.setItem(CACHE_PREFIX + number, JSON.stringify({ ayahs }));
}

// عدد آيات سورة واحدة مقروءة. القراءة مخزنة كمفاتيح "سورة:آية".
function readCountOf(surahNumber) {
  const prefix = surahNumber + ':';
  let count = 0;
  for (const key in state.read) {
    if (key.startsWith(prefix)) count++;
  }
  return count;
}

function surahStatusText(meta, readCount) {
  if (readCount >= meta.ayahs) return `${meta.ayahs} آية • ${meta.type} • ✔`;
  if (readCount > 0) return `${meta.ayahs} آية • ${meta.type} • ${readCount}/${meta.ayahs}`;
  return `${meta.ayahs} آية • ${meta.type}`;
}

function markAyahRead(surahNumber, ayahNumber, surahName) {
  const key = `${surahNumber}:${ayahNumber}`;
  if (state.read[key]) return;
  state.read[key] = true;
  state.last = { surah: surahNumber, ayah: ayahNumber, name: surahName };
  const today = todayKey();
  state.log[today] = (state.log[today] || 0) + 1;
}

function toggleAyahRead(surahNumber, ayahNumber, surahName) {
  const key = `${surahNumber}:${ayahNumber}`;
  if (state.read[key]) {
    delete state.read[key];
    return;
  }
  markAyahRead(surahNumber, ayahNumber, surahName);
}

function refreshAyahUI(surahNumber) {
  saveState();
  renderStats();
  updateSurahBadge(surahNumber);
}

function updateSurahBadge(surahNumber) {
  const el = document.querySelector(`[data-surah="${surahNumber}"]`);
  const meta = findSurah(surahNumber);
  if (!el || !meta) return;
  el.querySelector('small').textContent = surahStatusText(meta, readCountOf(surahNumber));
  el.classList.toggle('done', readCountOf(surahNumber) >= meta.ayahs);
}

function surahMatches(meta, query) {
  if (!query) return true;
  return (
    meta.name.includes(query) ||
    meta.english.toLowerCase().includes(query.toLowerCase()) ||
    String(meta.number) === query
  );
}

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
    button.className = 'surah-item' + (meta.number === currentSurah ? ' active' : '') + (done ? ' done' : '');
    button.innerHTML = `<span class="n">${meta.number}</span><span><b>سورة ${meta.name}</b><br><small>${surahStatusText(meta, readCount)}</small></span><span>${done ? '✔' : ''}</span>`;
    button.onclick = () => openSurah(meta.number);
    fragment.appendChild(button);
  });

  box.appendChild(fragment);
}

async function loadSurahAyahs(number, meta) {
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

function highlightActiveSurah(number) {
  document.querySelectorAll('.surah-item.active').forEach((el) => el.classList.remove('active'));
  document.querySelector(`[data-surah="${number}"]`)?.classList.add('active');
}

function createAyahElement(surahNumber, surahName, ayah) {
  const key = `${surahNumber}:${ayah.number}`;
  const isLast = state.last?.surah === surahNumber && state.last?.ayah === ayah.number;
  const span = document.createElement('span');
  span.className = 'ayah' + (state.read[key] ? ' read' : '') + (isLast ? ' last' : '');
  span.id = `ayah-${ayah.number}`;
  span.tabIndex = 0;
  span.setAttribute('role', 'button');
  span.setAttribute('aria-label', `آية ${ayah.number}${state.read[key] ? '، مقروءة' : ''}`);
  span.textContent = ayah.text + ' ';
  const badge = document.createElement('span');
  badge.className = 'ayah-num';
  const badgeNumber = document.createElement('span');
  badgeNumber.textContent = ayah.number;
  badge.appendChild(badgeNumber);
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
    ayahs = await loadSurahAyahs(number, meta);
  } catch {
    $('reader').textContent = 'تعذر تحميل النص (لا يوجد إنترنت ولا نسخة محفوظة). السور المحفوظة محلياً: الفاتحة، الإخلاص، الفلق، الناس. ستعمل باقي السور عند الاتصال بالإنترنت أول مرة ثم تُحفظ.';
    return;
  }

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

function completeCurrentSurah() {
  if (!currentSurah) return;
  const meta = findSurah(currentSurah);
  if (!meta) return;
  const ayahs = getCachedAyahs(currentSurah);
  const total = ayahs ? ayahs.length : meta.ayahs;
  for (let i = 1; i <= total; i++) markAyahRead(currentSurah, i, meta.name);
  state.last = { surah: currentSurah, ayah: total, name: meta.name };
  refreshAyahUI(currentSurah);
  openSurah(currentSurah);
}

function resetKhatma() {
  if (!confirm('هل تريد بدء ختمة جديدة؟ سيتم تصفير التقدم الحالي.')) return;
  if (Object.keys(state.read).length >= TOTAL_AYAS - 10) state.khatmaCount++;
  state.read = {};
  state.last = null;
  saveState();
  $('search').value = '';
  renderList('');
  renderStats();
  if (currentSurah) openSurah(currentSurah);
}

function changeFontSize(step) {
  fontSize = Math.min(3, Math.max(1.2, fontSize + step));
  state.fontSize = fontSize;
  saveState();
  $('reader').style.fontSize = fontSize + 'rem';
}

function renderStats() {
  const total = Object.keys(state.read).length;
  const percent = (total / TOTAL_AYAS) * 100;
  $('percent').textContent = percent.toFixed(2) + '%';
  $('statsLine').textContent = `${total} / ${TOTAL_AYAS} آية • المتبقي ${TOTAL_AYAS - total}`;
  $('progressFill').style.width = percent + '%';
  $('khatmaProgress')?.setAttribute('aria-valuenow', String(total));
  $('todayCount').textContent = `اليوم: ${state.log[todayKey()] || 0} / ${state.dailyGoal}`;
  $('khatmaCount').textContent = `ختمات مكتملة: ${state.khatmaCount}`;
  if (state.last) {
    $('continueBtn').textContent = `تابع: ${state.last.name} آية ${state.last.ayah}`;
    $('lastReadLine').textContent = `آخر قراءة: سورة ${state.last.name} — آية ${state.last.ayah}`;
  } else {
    $('lastReadLine').textContent = 'لم تبدأ بعد — اختر سورة من الفهرس';
  }
}

function checkKhatmaComplete() {
  if (Object.keys(state.read).length < TOTAL_AYAS) return;
  alert('ما شاء الله! أتممت الختمة. تقبل الله منك.');
  state.khatmaCount++;
  state.read = {};
  saveState();
  renderStats();
  renderList('');
}

function bindReaderKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    const ayahs = [...document.querySelectorAll('.ayah')];
    if (ayahs.length === 0) return;
    const index = ayahs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'j') {
      ayahs[Math.min(index + 1, ayahs.length - 1)]?.focus();
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' || e.key === 'k') {
      ayahs[Math.max(index - 1, 0)]?.focus();
      e.preventDefault();
    }
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList?.contains('ayah')) {
      document.activeElement.click();
      e.preventDefault();
    }
  });
}

function bindEvents() {
  $('dailyGoal').value = state.dailyGoal;
  $('dailyGoal').addEventListener('change', (e) => {
    state.dailyGoal = Math.max(1, parseInt(e.target.value) || 20);
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
  $('completeSurahBtn').addEventListener('click', completeCurrentSurah);
  $('prevSurah').addEventListener('click', () => {
    if (currentSurah > 1) openSurah(currentSurah - 1);
  });
  $('nextSurah').addEventListener('click', () => {
    if (currentSurah < 114) openSurah(currentSurah + 1);
  });
  bindReaderKeys();
}

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
  renderList('');
  renderStats();
  fontSize = state.fontSize || 1.9;
  $('reader').style.fontSize = fontSize + 'rem';
  openSurah(state.last?.surah || 1, state.last?.ayah);
}

init();
