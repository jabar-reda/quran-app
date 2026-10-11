const TOTAL_AYAS = 6236;
const LS_KEY = 'quran_tracker_v1';
const CACHE_PREFIX = 'surah_cache_';

const OFFLINE_SURAHS = window.OFFLINE_SURAHS || {};

let surahs = [];
let state = loadState();
let currentSurah = null;
let fontSize = 1.9;

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    return {
      read: s.read || {},
      last: s.last || null,
      khatmaCount: s.khatmaCount || 0,
      dailyGoal: s.dailyGoal || 20,
      fontSize: s.fontSize || 1.9,
      log: s.log || {}
    };
  }catch{ return {read:{}, last:null, khatmaCount:0, dailyGoal:20, fontSize:1.9, log:{}}; }
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

const $ = id => document.getElementById(id);
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const debounce = (fn, ms=200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

async function init(){
  try{
    const res = await fetch('data/surahs.json');
    if(!res.ok) throw new Error(res.status);
    surahs = await res.json();
  }catch{ $('surahList').textContent = 'تعذر تحميل فهرس السور.'; return; }
  $('dailyGoal').value = state.dailyGoal;
  $('dailyGoal').addEventListener('change', e=>{
    state.dailyGoal = Math.max(1, parseInt(e.target.value)||20);
    saveState(); renderStats();
  });
  $('search').addEventListener('input', debounce(e=> renderList(e.target.value)));
  document.querySelectorAll('[data-goto]').forEach(b=> b.addEventListener('click', ()=> openSurah(+b.dataset.goto)));
  $('continueBtn').addEventListener('click', ()=>{
    if(state.last) openSurah(state.last.surah, state.last.ayah);
    else openSurah(1);
  });
function refreshAyahUI(n){
  saveState(); renderStats(); updateSurahBadge(n);
}

  $('resetBtn').addEventListener('click', ()=>{
    if(!confirm('هل تريد بدء ختمة جديدة؟ سيتم تصفير التقدم الحالي.')) return;
    if(Object.keys(state.read).length >= TOTAL_AYAS-10) state.khatmaCount++;
    state.read = {}; state.last = null; saveState();
    $('search').value = ''; renderList(''); renderStats(); if(currentSurah) openSurah(currentSurah);
  });
  $('fontPlus').addEventListener('click', ()=>{ fontSize=Math.min(3,fontSize+0.15); state.fontSize=fontSize; saveState(); $('reader').style.fontSize=fontSize+'rem'; });
  $('fontMinus').addEventListener('click', ()=>{ fontSize=Math.max(1.2,fontSize-0.15); state.fontSize=fontSize; saveState(); $('reader').style.fontSize=fontSize+'rem'; });
  $('completeSurahBtn').addEventListener('click', ()=>{
    if(!currentSurah) return;
    const meta = surahs.find(s=>s.number===currentSurah);
    const ayahs = getCachedAyahs(currentSurah);
    const count = ayahs ? ayahs.length : meta.ayahs;
    const t = todayKey();
    for(let i=1;i<=count;i++){
      const key = `${currentSurah}:${i}`;
      if(!state.read[key]){ state.read[key] = true; state.log[t] = (state.log[t]||0) + 1; }
    }
    state.last = {surah: currentSurah, ayah: count, name: meta.name};
    refreshAyahUI(currentSurah); openSurah(currentSurah);
  });
  $('prevSurah').addEventListener('click', ()=>{ if(currentSurah>1) openSurah(currentSurah-1); });
  $('nextSurah').addEventListener('click', ()=>{ if(currentSurah<114) openSurah(currentSurah+1); });

  renderList(''); renderStats();
  fontSize = state.fontSize || 1.9; $('reader').style.fontSize = fontSize + 'rem';
  openSurah(state.last?.surah || 1, state.last?.ayah);
}

function getCachedAyahs(n){
  try{ const c = JSON.parse(localStorage.getItem(CACHE_PREFIX+n)); return c?.ayahs || null; }catch{ return null; }
}

function buildReadCounts(){
  const m = {};
  for(const k in state.read){ const n = +k.split(':')[0]; m[n] = (m[n]||0) + 1; }
  return m;
}

function updateSurahBadge(n){
  const el = document.querySelector(`[data-surah="${n}"]`);
  if(!el) return;
  const meta = surahs.find(s=>s.number===n);
  if(!meta) return;
  const c = countReadInSurah(n);
  const small = el.querySelector('small');
  if(small) small.textContent = `${meta.ayahs} آية • ${meta.type}` + (c>=meta.ayahs?' • ✔':c?` • ${c}/${meta.ayahs}`:'');
  el.classList.toggle('done', c >= meta.ayahs);
}

function renderList(filter=''){
  const box = $('surahList'); box.textContent='';
  const frag = document.createDocumentFragment();
  const f = filter.trim();
  const counts = buildReadCounts();
  surahs.filter(s=> !f || s.name.includes(f) || s.english.toLowerCase().includes(f.toLowerCase()) || String(s.number)===f)
  .forEach(s=>{
    const readCount = counts[s.number] || 0;
    const done = readCount >= s.ayahs;
    const d = document.createElement('button');
    d.type = 'button';
    d.dataset.surah = s.number;
    d.className = 'surah-item' + (s.number===currentSurah?' active':'') + (done?' done':'');
    d.innerHTML = `<span class="n">${s.number}</span><span><b>سورة ${s.name}</b><br><small>${s.ayahs} آية • ${s.type} ${done?'• ✔':readCount?`• ${readCount}/${s.ayahs}`:''}</small></span><span>${done?'✔':''}</span>`;
    d.onclick = ()=> openSurah(s.number);
    frag.appendChild(d);
  });
  box.appendChild(frag);
}

function countReadInSurah(n){
  let c=0; for(const k in state.read){ if(k.startsWith(n+':') && state.read[k]) c++; } return c;
}

async function openSurah(n, scrollToAyah=null){
  currentSurah = n;
  const meta = surahs.find(s=>s.number===n);
  $('surahTitle').textContent = `سورة ${meta.name}`;
  $('surahMeta').innerHTML = `<bdi>${meta.english}</bdi> • ${meta.ayahs} آية • ${meta.type}`;
  $('reader').textContent = 'جاري التحميل...';
  document.querySelectorAll('.surah-item.active').forEach(el=>el.classList.remove('active'));
  document.querySelector(`[data-surah="${n}"]`)?.classList.add('active');

  let data = null;
  const cached = getCachedAyahs(n);
  if(cached) data = {ayahs: cached};
  else if(OFFLINE_SURAHS[n]) data = OFFLINE_SURAHS[n];
  else {
    try{
      const r = await fetch(`https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`);
      if(!r.ok) throw new Error(r.status);
      const j = await r.json();
      data = { ayahs: j.data.ayahs.map(a=>({number:a.numberInSurah, text:a.text})) };
      localStorage.setItem(CACHE_PREFIX+n, JSON.stringify(data));
    }catch(e){
      $('reader').textContent = 'تعذر تحميل النص (لا يوجد إنترنت ولا نسخة محفوظة). السور المحفوظة محلياً: الفاتحة، الإخلاص، الفلق، الناس. ستعمل باقي السور عند الاتصال بالإنترنت أول مرة ثم تُحفظ.';
      return;
    }
  }
  // حفظ في الكاش لو كانت من OFFLINE
  if(OFFLINE_SURAHS[n] && !cached) localStorage.setItem(CACHE_PREFIX+n, JSON.stringify({ayahs: data.ayahs}));

  const reader = $('reader'); reader.textContent='';
  const rFrag = document.createDocumentFragment();
  if(n!==1 && n!==9){
    const b = document.createElement('div'); b.className='basmala'; b.textContent='بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'; rFrag.appendChild(b);
  }
  data.ayahs.forEach(a=>{
    const key = `${n}:${a.number}`;
    const span = document.createElement('span');
    span.className = 'ayah' + (state.read[key]?' read':'') + (state.last?.surah===n && state.last?.ayah===a.number?' last':'');
    span.id = `ayah-${a.number}`;
    span.textContent = a.text + ' ';
    const num = document.createElement('span');
    num.className = 'ayah-num';
    const numInner = document.createElement('span');
    numInner.textContent = a.number;
    num.appendChild(numInner);
    span.appendChild(num);
    span.appendChild(document.createTextNode(' '));
    span.setAttribute('aria-label', `آية ${a.number}${state.read[key] ? '، مقروءة' : ''}`);
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.onclick = ()=>{
      if(state.read[key]) delete state.read[key];
      else{
        state.read[key] = true;
        state.last = {surah:n, ayah:a.number, name:meta.name};
        const t = todayKey(); state.log[t]=(state.log[t]||0)+1;
      }
      refreshAyahUI(n);
      span.classList.toggle('read');
      document.querySelectorAll('.ayah.last').forEach(el=>el.classList.remove('last'));
      if(state.last?.surah===n) document.getElementById(`ayah-${state.last.ayah}`)?.classList.add('last');
      checkKhatmaComplete();
    };
    rFrag.appendChild(span);
  });
  reader.appendChild(rFrag);

  if(scrollToAyah) setTimeout(()=> document.getElementById(`ayah-${scrollToAyah}`)?.scrollIntoView({behavior:'smooth',block:'center'}),100);
}

function renderStats(){
  const total = Object.keys(state.read).length;
  const pct = (total/TOTAL_AYAS*100);
  $('percent').textContent = pct.toFixed(2)+'%';
  $('statsLine').textContent = `${total} / ${TOTAL_AYAS} آية • المتبقي ${TOTAL_AYAS-total}`;
  $('progressFill').style.width = pct+'%';
  $('khatmaProgress')?.setAttribute('aria-valuenow', String(total));
  $('todayCount').textContent = `اليوم: ${state.log[todayKey()]||0} / ${state.dailyGoal}`;
  $('khatmaCount').textContent = `ختمات مكتملة: ${state.khatmaCount}`;
  if(state.last){ $('continueBtn').textContent = `تابع: ${state.last.name} آية ${state.last.ayah}`; $('lastReadLine').textContent = `آخر قراءة: سورة ${state.last.name} — آية ${state.last.ayah}`; }
  else { $('lastReadLine').textContent = 'لم تبدأ بعد — اختر سورة من الفهرس'; }
}

function checkKhatmaComplete(){
  if(Object.keys(state.read).length >= TOTAL_AYAS){
    alert('ما شاء الله! أتممت الختمة. تقبل الله منك.');
    state.khatmaCount++; state.read={}; saveState(); renderStats(); renderList('');
  }
}

document.addEventListener('keydown', e=>{
  if(e.target.matches('input, textarea')) return;
  const ayahs = [...document.querySelectorAll('.ayah')];
  if(!ayahs.length) return;
  const i = ayahs.indexOf(document.activeElement);
  if(e.key === 'ArrowDown' || e.key === 'j'){ ayahs[Math.min(i+1, ayahs.length-1)]?.focus(); e.preventDefault(); }
  if(e.key === 'ArrowUp' || e.key === 'k'){ ayahs[Math.max(i-1, 0)]?.focus(); e.preventDefault(); }
  if((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList?.contains('ayah')){ document.activeElement.click(); e.preventDefault(); }
});

init();
