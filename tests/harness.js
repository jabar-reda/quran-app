'use strict';
/* ===== حزمة اختبار محلية (بلا أي اعتماديات) =====
   تُحمّل js/app.js و js/preload.js داخل sandbox معزول من node:vm مع بدائل (stubs)
   لـ window/document/localStorage/navigator/fetch/Blob/URL/timers، ثم تكشف الدوال
   الداخلية عبر window.__hooks. لا تعدّل ملفات المشروع ولا تحتاج خادمًا.
   كل ما تحتاجه: وحدات Node المدمجة فقط (fs/path/vm).

   الاستخدام:
     const { createAppSandbox, createPreloadSandbox, readSurahs } = require('./harness.js');
     const app = createAppSandbox();          // state نظيف + فهرس السور الحقيقي
     app.hooks.normalizeArabic('إبراهيم');
*/
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function readProjectFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// فهرس السور الحقيقي من data/surahs.json — مرجع يبنى عليه findSurah في الاختبارات.
function readSurahs() {
  return JSON.parse(readProjectFile('data/surahs.json'));
}

// يقرأ window.OFFLINE_SURAHS من js/offline-surahs.js داخل sandbox طفيف.
function readOfflineSurahs() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readProjectFile('js/offline-surahs.js'), sandbox, { filename: 'js/offline-surahs.js' });
  return sandbox.window.OFFLINE_SURAHS;
}

// يعيد بناء القيم العادية القادمة من عالم vm في عالم Node.
// الكائنات المنشأة داخل vm لها Object.prototype مختلف، فيرفضها assert.deepEqual
// (alias لـ deepStrictEqual) رغم تطابق المحتوى. structuredClone يتجاوز حدود العالم،
// وإن تعذّر (دالة/DOM stub) تُترك القيمة كما هي.
function toHost(value) {
  if (value === null || typeof value !== 'object') return value;
  try { return structuredClone(value); } catch { return value; }
}

// يلفّ كل دوال __hooks حتى تعود قيمها من عالم Node (الإعدادات تبقى بلا تحويل).
function exposeHooks(hooks) {
  Object.keys(hooks).forEach((key) => {
    const original = hooks[key];
    if (typeof original !== 'function') return;
    hooks[key] = function exposedHook(...args) { return toHost(original.apply(this, args)); };
  });
  return hooks;
}

// ===== بديل localStorage =====
function makeLocalStorage(initial) {
  const store = new Map();
  if (initial) Object.entries(initial).forEach(([k, v]) => store.set(k, String(v)));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
    _dump: () => Object.fromEntries(store),
  };
}

// ===== بديل عنصر DOM =====
// querySelector يرجع عنصرًا (لا null) حتى لا تنكسر المسارات التي لا تخص الاختبار.
function makeElement(tag) {
  const classes = new Set();
  const attributes = new Map();
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    nodeType: 1,
    children: [],
    dataset: {},
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    textContent: '',
    innerHTML: '',
    value: '',
    id: '',
    href: '',
    download: '',
    hidden: false,
    disabled: false,
    checked: false,
    type: '',
    className: '',
    onclick: null,
    onchange: null,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
      contains: (c) => classes.has(c),
      _all: () => [...classes],
    },
    setAttribute(k, v) { attributes.set(k, String(v)); },
    getAttribute(k) { return attributes.has(k) ? attributes.get(k) : null; },
    removeAttribute(k) { attributes.delete(k); },
    hasAttribute(k) { return attributes.has(k); },
    appendChild(child) { el.children.push(child); return child; },
    append(...nodes) { nodes.forEach((n) => el.children.push(n)); },
    removeChild(child) { el.children = el.children.filter((c) => c !== child); return child; },
    remove() {},
    focus() {},
    click() { if (typeof el.onclick === 'function') el.onclick({}); },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    querySelector() { return makeElement('div'); },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    _attributes: attributes,
    _classes: classes,
  };
  return el;
}

function makeDocument() {
  const byId = new Map();
  const created = [];
  return {
    documentElement: makeElement('html'),
    body: makeElement('body'),
    activeElement: null,
    readyState: 'complete',
    referrer: '',
    createElement(tag) { const el = makeElement(tag); created.push(el); return el; },
    createDocumentFragment() { return makeElement('#fragment'); },
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    getElementById(id) {
      if (!byId.has(id)) { const el = makeElement('div'); el.id = id; byId.set(id, el); }
      return byId.get(id);
    },
    querySelector() { return makeElement('div'); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    _byId: byId,
    _created: created,
  };
}

function makeNavigator(overrides) {
  return {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    language: 'ar',
    onLine: true,
    standalone: false,
    connection: {},
    ...(overrides || {}),
  };
}

function makeMediaQueryList(matches) {
  return { matches: !!matches, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
}

function makeBlobClass() {
  return class FakeBlob {
    constructor(parts, opts) {
      this.parts = Array.isArray(parts) ? parts : (parts ? [parts] : []);
      this.type = (opts && opts.type) || '';
      this.size = this.parts.reduce((n, p) => n + String(p).length, 0);
    }
  };
}

function makeURLStub() {
  const stub = {
    lastBlob: null,
    createObjectURL(blob) { stub.lastBlob = blob; return 'blob:fake-url'; },
    revokeObjectURL() {},
  };
  return stub;
}

function makeCustomEventClass() {
  return class FakeCustomEvent {
    // detail يُنشأ داخل sandbox غالبًا، فيُعاد بناؤه في عالم Node ليقارنه الاختبار.
    constructor(type, opts) { this.type = type; this.detail = toHost(opts && opts.detail); }
  };
}

// مؤقتات مزيّفة: تُخزَّن وتُنفَّذ عبر flush() يدويًا (لا توقف عملية Node).
function makeFakeTimers() {
  let seq = 0;
  let queue = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; queue.set(id, { fn, ms: ms || 0 }); return id; },
    clearTimeout(id) { queue.delete(id); },
    flush() {
      const pending = [...queue.entries()];
      queue = new Map();
      pending.forEach(([, t]) => { try { t.fn(); } catch { /* تجاهل */ } });
      return pending.length;
    },
    pendingCount() { return queue.size; },
  };
}

// مؤقتات فورية: تُنفَّذ عبر microtask (تجعل حلقات preload تُكمل بسرعة وبلا انتظار).
function makeImmediateTimers() {
  let seq = 0;
  const live = new Set();
  return {
    setTimeout(fn) {
      const id = ++seq;
      live.add(id);
      queueMicrotask(() => { if (live.has(id)) { live.delete(id); fn(); } });
      return id;
    },
    clearTimeout(id) { live.delete(id); },
    flush() {},
    pendingCount() { return live.size; },
  };
}

// كود يُلحق بآخر app.js داخل نفس الـ sandbox (يرى const/let الداخلية) ويكشف الدوال عبر window.
const APP_HOOKS = `
;window.__hooks = {
  TOTAL_AYAS, KHATMA_RESET_MARGIN, LS_KEY, BACKUP_KEY, CACHE_PREFIX,
  PROGRESS_FORMAT, APP_VERSION, PROGRESS_MAX_BYTES, SOURCE_LABELS,
  getState: () => state,
  setState: (v) => { state = v; },
  getSurahs: () => surahs,
  setSurahs: (v) => { surahs = v; },
  getCurrentSurah: () => currentSurah,
  setCurrentSurah: (v) => { currentSurah = v; },
  replaceShowModal: (fn) => { showModal = fn; },
  pad2, dateKeyOf, todayKey, debounce, defaultState, loadState, saveState, findSurah,
  getCachedAyahs, saveSurahCache, readTotal, readCountOf, surahStatusText,
  markAyahRead, toggleAyahRead, refreshAyahUI, updateSurahBadge,
  normalizeArabic, normalizeDigits, surahMatches, renderList, loadSurahAyahs,
  stripBasmalaPrefix, highlightActiveSurah, createAyahElement, openSurah,
  completeCurrentSurah, resetKhatma, isDayString, isFutureDay, daysAgoText,
  renderTransferStatus, localStamp, timezoneInfo, detectSource, detectDevice,
  readToAyahs, ayahsToRead, buildSummary, collectProgress, exportProgress,
  parseProgressFile, describeImportMeta, sanitizeLog, mergeRead, mergeLog,
  refreshAfterImport, showImportPreview, applyImport, undoImport, pickImportFile,
  handleImportFile, currentTheme, applyTheme, toggleTheme, changeFontSize,
  applyReaderFontSize, renderStats, checkKhatmaComplete, showModal,
  cachedSurahCount, updateCacheBar, hideCacheBar, showCacheBar, updateNetStatus,
  applyGoalUI, bindEvents, renderDaily, init,
};
`;

// ===== sandbox التطبيق (js/app.js) =====
function createAppSandbox(options) {
  const opts = options || {};
  const surahs = opts.surahs !== undefined ? opts.surahs : readSurahs();
  const localStorage = makeLocalStorage(opts.storage);
  const timers = opts.timers || makeFakeTimers();
  const document = opts.document || makeDocument();
  const navigator = makeNavigator(opts.navigator);
  const location = opts.location || { origin: 'http://localhost:8000', hostname: 'localhost' };
  const fetchImpl = opts.fetch || (() => new Promise(() => {}));
  let matchMedia = opts.matchMedia || (() => makeMediaQueryList(false));

  const window = {
    OFFLINE_SURAHS: opts.offlineSurahs || {},
    SurahPreloader: opts.surahPreloader,
    Capacitor: opts.capacitor,
    matchMedia: (q) => matchMedia(q),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    scrollTo() {},
  };

  const sandbox = {
    window, document, localStorage, navigator, location,
    history: {},
    fetch: fetchImpl,
    Blob: makeBlobClass(),
    URL: makeURLStub(),
    CustomEvent: makeCustomEventClass(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(readProjectFile('js/app.js') + APP_HOOKS, sandbox, { filename: 'js/app.js' });

  const hooks = exposeHooks(window.__hooks);
  hooks.setSurahs(surahs);
  if (opts.resetState !== false) hooks.setState(hooks.defaultState());
  return {
    hooks, sandbox, localStorage, document, navigator, location, timers,
    window, Blob: sandbox.Blob, URL: sandbox.URL, surahs,
    setMatchMedia(fn) { matchMedia = fn; },
  };
}

// ===== sandbox ما قبل التحميل (js/preload.js) =====
function createPreloadSandbox(options) {
  const opts = options || {};
  const localStorage = makeLocalStorage(opts.storage);
  const timers = opts.timers || makeImmediateTimers();
  const document = opts.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
  const navigator = makeNavigator(opts.navigator);
  const events = [];
  const fetchCalls = [];
  const fetchImpl = opts.fetch || (() => new Promise(() => {}));

  const window = {
    dispatchEvent(e) { events.push(e); return true; },
    addEventListener() {}, removeEventListener() {},
  };
  const sandbox = {
    window, document, localStorage, navigator,
    fetch: (url, ...rest) => { fetchCalls.push(url); return fetchImpl(url, ...rest); },
    CustomEvent: makeCustomEventClass(),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(readProjectFile('js/preload.js'), sandbox, { filename: 'js/preload.js' });

  return { preloader: window.SurahPreloader, sandbox, localStorage, timers, events, fetchCalls, document, navigator };
}

module.exports = {
  ROOT,
  readProjectFile,
  readSurahs,
  readOfflineSurahs,
  makeLocalStorage,
  makeElement,
  makeDocument,
  makeNavigator,
  makeMediaQueryList,
  makeFakeTimers,
  makeImmediateTimers,
  createAppSandbox,
  createPreloadSandbox,
};
