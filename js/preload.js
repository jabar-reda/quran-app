/* مدير التحميل الخلفي للسور — ملف مخصص لهذه المهمة فقط.
   الفكرة: بعد فتح الصفحة يُنزّل السور غير المحفوظة واحدة واحدة إلى localStorage (بنفس شكل surah_cache_<n>)
   بسرعة قصوى 1MB/s، ويتوقف مؤقتًا أثناء فتح المستخدم لسورة (لتُحمّل بأقصى سرعة) ثم يستأنف أثناء القراءة.
   يُحمّل هذا الملف قبل js/app.js. التواصل مع التطبيق عبر أحداث window فقط — لا يعتمد على دوال app.js. */
window.SurahPreloader = (() => {
  const CACHE_PREFIX = 'surah_cache_';
  const TOTAL_SURAHS = 114;
  const MAX_BYTES_PER_SEC = 1024 * 1024; // سقف السرعة: 1MB في الثانية (متوسط — لا أكثر).
  const API = (n) => `https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`;

  let queue = []; // أرقام السور المتبقية.
  let running = false;
  let userActive = false; // true أثناء جلب المستخدم لسورة — الأولوية القصوى له.
  let timer = null;

  // هل السورة محفوظة؟ (نفس شكل الكاش في app.js).
  function isCached(n) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_PREFIX + n));
      return !!(c && c.ayahs && c.ayahs.length);
    } catch { return false; }
  }

  // يُخرج سورة من الطابور (عندما يفتحها المستخدم بنفسه — لا داعي لتنزيلها خلفه).
  function dequeue(n) {
    queue = queue.filter((x) => x !== n);
  }

  // يبني الطابور: جوار السورة الحالية أولًا، ثم المقترحة، ثم الباقي بالترتيب — متخطيًا المحفوظ.
  function buildQueue(current) {
    const seen = new Set();
    const ordered = [];
    const push = (n) => {
      if (n >= 1 && n <= TOTAL_SURAHS && !seen.has(n) && !isCached(n)) { seen.add(n); ordered.push(n); }
    };
    if (current) { push(current - 1); push(current + 1); }
    [18, 36, 56].forEach(push); // سور مقترحة الواجهة.
    for (let n = 1; n <= TOTAL_SURAHS; n++) push(n);
    queue = ordered;
  }

  function emitProgress(cached, total) {
    window.dispatchEvent(new CustomEvent('surah-cache-progress', { detail: { cached, total } }));
  }

  function wait(ms) {
    return new Promise((r) => { timer = setTimeout(r, ms); });
  }

  // ينزّل سورة واحدة ويحفظها، ويرجع حجمها بالبايت لحساب الترويسة الزمنية.
  async function fetchOne(n) {
    const res = await fetch(API(n));
    if (!res.ok) throw new Error(res.status);
    const text = await res.text(); // نص أولًا لقياس الحجم الحقيقي قبل التحويل.
    const json = JSON.parse(text);
    const ayahs = json.data.ayahs.map((a) => ({ number: a.numberInSurah, text: a.text }));
    localStorage.setItem(CACHE_PREFIX + n, JSON.stringify({ ayahs }));
    return text.length;
  }

  async function loop() {
    if (running) return;
    running = true;
    while (queue.length > 0) {
      // إيقاف مؤقت: المستخدم يجلِب الآن، أو التبويب مخفي، أو لا إنترنت، أو توفير البيانات مفعّل.
      if (userActive || document.hidden || !navigator.onLine || navigator.connection?.saveData) {
        await wait(1000);
        continue;
      }
      const n = queue[0];
      if (isCached(n)) { queue.shift(); continue; } // حُفظت أثناء الانتظار (فتحها المستخدم).
      try {
        const bytes = await fetchOne(n);
        queue.shift();
        emitProgress(TOTAL_SURAHS - queue.length, TOTAL_SURAHS);
        // ترويسة السرعة: نوم بمقدار الحجم ÷ 1MB/s ليبقى المتوسط ≤ السقف.
        await wait((bytes / MAX_BYTES_PER_SEC) * 1000);
      } catch {
        // فشل (انقطاع غالبًا): أعدها لآخر الطابور وحاول بعد 5 ثوانٍ.
        queue.push(queue.shift());
        await wait(5000);
      }
    }
    running = false;
    emitProgress(TOTAL_SURAHS, TOTAL_SURAHS); // اكتمل: كل السور محفوظة.
  }

  return {
    // يبدأ التحميل الخلفي (يُستدعى من init بعد رسم الواجهة). لا يعمل مرتين.
    start(current) {
      if (running || queue.length > 0) return;
      if (!navigator.onLine || navigator.connection?.saveData) return; // احترام توفير البيانات.
      buildQueue(current);
      if (queue.length > 0) loop();
    },
    // يعلِم المدير أن المستخدم بدأ/أنهى جلبًا — فيتوقف/يستأنف تلقائيًا.
    userActive(v) { userActive = !!v; },
    dequeue,
    pendingCount() { return queue.length; },
    isRunning() { return running; },
  };
})();
