const TOTAL_AYAS = 6236;
const LS_KEY = 'quran_tracker_v1';
const CACHE_PREFIX = 'surah_cache_';

const OFFLINE_SURAHS = {
  1: { number: 1, name: 'الفاتحة', ayahs: [
    {number:1, text:'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'},
    {number:2, text:'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'},
    {number:3, text:'الرَّحْمَٰنِ الرَّحِيمِ'},
    {number:4, text:'مَالِكِ يَوْمِ الدِّينِ'},
    {number:5, text:'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ'},
    {number:6, text:'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ'},
    {number:7, text:'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ'},
  ]},
  112: { number:112, name:'الإخلاص', ayahs:[
    {number:1, text:'قُلْ هُوَ اللَّهُ أَحَدٌ'},
    {number:2, text:'اللَّهُ الصَّمَدُ'},
    {number:3, text:'لَمْ يَلِدْ وَلَمْ يُولَدْ'},
    {number:4, text:'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ'},
  ]},
  113: { number:113, name:'الفلق', ayahs:[
    {number:1, text:'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ'},
    {number:2, text:'مِن شَرِّ مَا خَلَقَ'},
    {number:3, text:'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ'},
    {number:4, text:'وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ'},
    {number:5, text:'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ'},
  ]},
  114: { number:114, name:'الناس', ayahs:[
    {number:1, text:'قُلْ أَعُوذُ بِرَبِّ النَّاسِ'},
    {number:2, text:'مَلِكِ النَّاسِ'},
    {number:3, text:'إِلَٰهِ النَّاسِ'},
    {number:4, text:'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ'},
    {number:5, text:'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ'},
    {number:6, text:'مِنَ الْجِنَّةِ وَالنَّاسِ'},
  ]}
};

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
      log: s.log || {}
    };
  }catch{ return {read:{}, last:null, khatmaCount:0, dailyGoal:20, log:{}}; }
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

const $ = id => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0,10);

async function init(){
  const res = await fetch('data/surahs.json');
  surahs = await res.json();
  $('dailyGoal').value = state.dailyGoal;
  $('dailyGoal').addEventListener('change', e=>{
    state.dailyGoal = Math.max(1, parseInt(e.target.value)||20);
    saveState(); renderStats();
  });
  $('search').addEventListener('input', e=> renderList(e.target.value));
  $('continueBtn').addEventListener('click', ()=>{
    if(state.last) openSurah(state.last.surah, state.last.ayah);
    else openSurah(1);
  });
  $('resetBtn').addEventListener('click', ()=>{
    if(!confirm('هل تريد بدء ختمة جديدة؟ سيتم تصفير التقدم الحالي.')) return;
    if(Object.keys(state.read).length >= TOTAL_AYAS-10) state.khatmaCount++;
    state.read = {}; state.last = null; saveState();
    renderList(''); renderStats(); if(currentSurah) openSurah(currentSurah);
  });
  $('fontPlus').addEventListener('click', ()=>{ fontSize=Math.min(3,fontSize+0.15); $('reader').style.fontSize=fontSize+'rem'; });
  $('fontMinus').addEventListener('click', ()=>{ fontSize=Math.max(1.2,fontSize-0.15); $('reader').style.fontSize=fontSize+'rem'; });
  $('completeSurahBtn').addEventListener('click', ()=>{
    if(!currentSurah) return;
    const meta = surahs.find(s=>s.number===currentSurah);
    const ayahs = getCachedAyahs(currentSurah);
    const count = ayahs ? ayahs.length : meta.ayahs;
    for(let i=1;i<=count;i++) markRead(currentSurah,i,false);
    saveState(); renderList($('search').value); renderStats(); openSurah(currentSurah);
  });
  $('prevSurah').addEventListener('click', ()=>{ if(currentSurah>1) openSurah(currentSurah-1); });
  $('nextSurah').addEventListener('click', ()=>{ if(currentSurah<114) openSurah(currentSurah+1); });

  renderList(''); renderStats();
  openSurah(state.last?.surah || 1, state.last?.ayah);
}

function getCachedAyahs(n){
  try{ const c = JSON.parse(localStorage.getItem(CACHE_PREFIX+n)); return c?.ayahs || null; }catch{ return null; }
}

function renderList(filter=''){
  const box = $('surahList'); box.innerHTML='';
  const f = filter.trim();
  surahs.filter(s=> !f || s.name.includes(f) || s.english.toLowerCase().includes(f.toLowerCase()) || String(s.number)===f)
  .forEach(s=>{
    const readCount = countReadInSurah(s.number);
    const done = readCount >= s.ayahs;
    const d = document.createElement('div');
    d.className = 'surah-item' + (s.number===currentSurah?' active':'') + (done?' done':'');
    d.innerHTML = `<span class="n">${s.number}</span><span><b>سورة ${s.name}</b><br><small class="muted">${s.ayahs} آية • ${s.type} ${done?'• ✔':readCount?`• ${readCount}/${s.ayahs}`:''}</small></span><span>${done?'✔':''}</span>`;
    d.onclick = ()=> openSurah(s.number);
    box.appendChild(d);
  });
}

function countReadInSurah(n){
  let c=0; for(const k in state.read){ if(k.startsWith(n+':') && state.read[k]) c++; } return c;
}

async function openSurah(n, scrollToAyah=null){
  currentSurah = n;
  const meta = surahs.find(s=>s.number===n);
  $('surahTitle').textContent = `سورة ${meta.name}`;
  $('surahMeta').textContent = `${meta.english} • ${meta.ayahs} آية • ${meta.type}`;
  $('reader').innerHTML = 'جاري التحميل...';
  renderList($('search').value);

  let data = null;
  const cached = getCachedAyahs(n);
  if(cached) data = {ayahs: cached};
  else if(OFFLINE_SURAHS[n]) data = OFFLINE_SURAHS[n];
  else {
    try{
      const r = await fetch(`https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`);
      const j = await r.json();
      data = { ayahs: j.data.ayahs.map(a=>({number:a.numberInSurah, text:a.text})) };
      localStorage.setItem(CACHE_PREFIX+n, JSON.stringify(data));
    }catch(e){
      $('reader').innerHTML = 'تعذر تحميل النص (لا يوجد إنترنت ولا نسخة محفوظة). السور المحفوظة محلياً: الفاتحة، الإخلاص، الفلق، الناس. ستعمل باقي السور عند الاتصال بالإنترنت أول مرة ثم تُحفظ.';
      return;
    }
  }
  // حفظ في الكاش لو كانت من OFFLINE
  if(OFFLINE_SURAHS[n] && !cached) localStorage.setItem(CACHE_PREFIX+n, JSON.stringify({ayahs: data.ayahs}));

  const reader = $('reader'); reader.innerHTML='';
  if(n!==1 && n!==9){
    const b = document.createElement('div'); b.className='basmala'; b.textContent='بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'; reader.appendChild(b);
  }
  data.ayahs.forEach(a=>{
    const key = `${n}:${a.number}`;
    const span = document.createElement('span');
    span.className = 'ayah' + (state.read[key]?' read':'') + (state.last?.surah===n && state.last?.ayah===a.number?' last':'');
    span.id = `ayah-${a.number}`;
    span.innerHTML = `${a.text} <span class="ayah-num"><span>${a.number}</span></span> `;
    span.title = 'اضغط لتعليم كمقروء';
    span.onclick = ()=>{
      state.read[key] = !state.read[key];
      if(state.read[key]){
        state.last = {surah:n, ayah:a.number, name:meta.name};
        const t = todayKey(); state.log[t]=(state.log[t]||0)+1;
      }
      if(!state.read[key]) delete state.read[key];
      saveState(); renderStats(); renderList($('search').value);
      span.classList.toggle('read');
      document.querySelectorAll('.ayah.last').forEach(el=>el.classList.remove('last'));
      if(state.last?.surah===n) document.getElementById(`ayah-${state.last.ayah}`)?.classList.add('last');
      checkKhatmaComplete();
    };
    reader.appendChild(span);
  });

  if(scrollToAyah) setTimeout(()=> document.getElementById(`ayah-${scrollToAyah}`)?.scrollIntoView({behavior:'smooth',block:'center'}),100);
}

function markRead(surah, ayah, save=true){
  const key = `${surah}:${ayah}`;
  if(!state.read[key]){
    state.read[key]=true;
    const t=todayKey(); state.log[t]=(state.log[t]||0)+1;
    state.last={surah, ayah, name: surahs.find(s=>s.number===surah)?.name||''};
  }
  if(save){ saveState(); renderStats(); }
}

function renderStats(){
  const total = Object.keys(state.read).length;
  const pct = (total/TOTAL_AYAS*100);
  $('percent').textContent = pct.toFixed(2)+'%';
  $('statsLine').textContent = `${total} / ${TOTAL_AYAS} آية • المتبقي ${TOTAL_AYAS-total}`;
  $('progressFill').style.width = pct+'%';
  $('todayCount').textContent = `اليوم: ${state.log[todayKey()]||0} / ${state.dailyGoal}`;
  $('khatmaCount').textContent = `ختمات مكتملة: ${state.khatmaCount}`;
  if(state.last) $('continueBtn').textContent = `تابع: ${state.last.name} آية ${state.last.ayah}`;
}

function checkKhatmaComplete(){
  if(Object.keys(state.read).length >= TOTAL_AYAS){
    alert('🎉 ما شاء الله! أتممت الختمة. تقبل الله منك.');
    state.khatmaCount++; state.read={}; saveState(); renderStats(); renderList('');
  }
}

init();
