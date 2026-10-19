const KEY = 'quolingo-chapters-v2';
const LEGACY_KEY = 'quolingo-journal-v1';
const PROFILE_KEY = 'quolingo-profile-v1';
const AVATARS = {muni:{emoji:'🦊',name:'뮤니'},ko:{emoji:'🐥',name:'코'},tas:{emoji:'🐻',name:'타스'}};
const fields = ['observation', 'interpretation', 'application'];
const parts = ['관찰', '해석', '적용'];
const content = document.querySelector('#content');
let data = {}, legacy = {}, page = 'home', stage = 0, selected = CHAPTERS[0].id;
let rangeStart = 1, rangeEnd = CHAPTERS[0].verses.length;
function load(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
data = load(KEY); legacy = load(LEGACY_KEY);
const savedProfile=load(PROFILE_KEY);
let profile={name:typeof savedProfile.name==='string'?savedProfile.name.slice(0,20):'',avatar:Object.hasOwn(AVATARS,savedProfile.avatar)?savedProfile.avatar:'ko'};
// Keep existing chapter journals as full-chapter sessions; retain original fields.
for (const day of Object.values(data)) {
  for (const c of ALL_CHAPTERS) {
    const entry = day?.[c.id];
    if (!entry || typeof entry !== 'object' || entry.sessions) continue;
    const previous = Object.fromEntries(fields.map(f => [f, entry[f] || '']));
    entry.sessions = {[`1-${c.verses.length}`]: {...previous, start:1, end:c.verses.length,
      read:Array.isArray(entry.read) ? [...entry.read] : [], completed:Boolean(entry.completed)}};
  }
}
function dayKey(date = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function shiftDay(key, n) { const date = new Date(key + 'T12:00:00+09:00'); date.setUTCDate(date.getUTCDate() + n); return dayKey(date); }
let today = dayKey();
let selectedDate = today;
function chapter() { return CHAPTERS.find(c => c.id === selected) || CHAPTERS[0]; }
function record(id = selected, date = selectedDate) { return data[date]?.[id] || {}; }
function readVerses(id = selected, date = today) {
  const c = ALL_CHAPTERS.find(c => c.id === id);
  return [...new Set(Array.isArray(record(id,date).read) ? record(id,date).read : [])].filter(n => Number.isInteger(n) && n >= 1 && n <= c.verses.length).sort((a,b) => a-b);
}
function rangeKey() { return `${rangeStart}-${rangeEnd}`; }
function sessionRecord() { return record().sessions?.[rangeKey()] || {}; }
function selectedVerses() { return Array.from({length:rangeEnd-rangeStart+1}, (_,i)=>rangeStart+i); }
function reference(c = chapter(), start = rangeStart, end = rangeEnd) {
  return `${c.book} ${c.chapter}:${start}${start===end?'':'–'+end}`;
}
function validRange(c, start, end) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= c.verses.length;
}
function updateRecord(changes) {
  const entry = record();
  const session = {...sessionRecord(), start:rangeStart, end:rangeEnd, ...changes};
  const read = changes.read ? [...new Set([...readVerses(selected,selectedDate), ...changes.read])].sort((a,b)=>a-b) : readVerses(selected,selectedDate);
  data[selectedDate] = {...data[selectedDate], [selected]: {...entry, read, lastRange:{start:rangeStart,end:rangeEnd},
    sessions:{...entry.sessions, [rangeKey()]:session}}};
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch { toast('브라우저 저장 실패 · 나의 묵상에서 파일로 백업해 주세요.'); return false; }
}
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
function completedDay(date) { return Boolean(legacy[date]?.completed || ALL_CHAPTERS.some(c => record(c.id,date).completed || Object.values(record(c.id,date).sessions || {}).some(r=>r.completed))); }
function streak() { let n=0, key=completedDay(today)?today:shiftDay(today,-1); while(completedDay(key)){n++;key=shiftDay(key,-1);} return n; }
function dateReadCount(date) { return ALL_CHAPTERS.reduce((sum,c)=>sum+readVerses(c.id,date).length,0); }
function todayCount() { return dateReadCount(today); }
function allTimeCount() {
  return Object.keys(data).filter(date=>validDay(date)&&date<=today).reduce((sum,date)=>sum+dateReadCount(date),0);
}
function validDay(date) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const value=new Date(date+'T12:00:00+09:00');
  return Number.isFinite(value.getTime())&&dayKey(value)===date;
}
function dateLabel(date) {
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric'}).format(new Date(date+'T12:00:00+09:00'));
}
function monthDates(date=today) {
  const first=date.slice(0,7)+'-01';const result=[];
  for(let day=first;day.slice(0,7)===first.slice(0,7);day=shiftDay(day,1))result.push(day);
  return result;
}
function monthWeek(date) {
  const first=date.slice(0,7)+'-01';
  const offset=(new Date(first+'T12:00:00+09:00').getUTCDay()+6)%7;
  return Math.floor((offset+Number(date.slice(8))-1)/7);
}
function dayReadingPercent(date) {
  const started=ALL_CHAPTERS.filter(c=>readVerses(c.id,date).length);
  const total=started.reduce((sum,c)=>sum+c.verses.length,0);
  return total?dateReadCount(date)/total*100:0;
}
function toast(message) { const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500); }
function updateStats() {
  const count=todayCount(), days=streak();
  document.querySelectorAll('[data-stat="streak"]').forEach(el=>el.textContent=days);
  document.querySelectorAll('[data-stat="total"]').forEach(el=>el.textContent=count);
  document.querySelectorAll('[data-profile-avatar]').forEach(el=>el.textContent=profile.name?AVATARS[profile.avatar].emoji:'👤');
  const weekday=new Date(today+'T12:00:00+09:00').getUTCDay();const monday=shiftDay(today,-((weekday+6)%7));
  document.querySelector('#week').innerHTML=['월','화','수','목','금','토','일'].map((label,i)=>{
    const date=shiftDay(monday,i),done=completedDay(date);
    return `<div class="day ${date===today?'today':''} ${done?'checked':''}" data-date="${date}" aria-label="${date} ${label}요일 ${done?'묵상 완료':'미완료'}"><span>${label}</span><i aria-hidden="true">${done?'✓':'·'}</i></div>`;
  }).join('');
}
function render(target=page) {
  page=target; document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page || ['editor','selection'].includes(page)&&b.dataset.page==='home'));
  ({home,selection,editor,journal,activity,success,account}[page] || home)();updateStats();
}
function star() { return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 2 4.3 8.7 9.6 1.4-6.9 6.7 1.6 9.5L16 23.8l-8.6 4.5L9 18.8l-6.9-6.7 9.6-1.4Z" fill="currentColor"/></svg>'; }
function home() {
  const dates=monthDates();const month=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long'}).format(new Date(today+'T12:00:00+09:00'));
  content.innerHTML=`<section class="unit"><div><small>말씀 여행 · 여호수아</small><h1>${month}</h1></div></section><div class="chapter-path month-path">${dates.map((date,i)=>{
    const done=completedDay(date),active=date===today,future=date>today;
    const weekday=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',weekday:'short'}).format(new Date(date+'T12:00:00+09:00'));
    const divider=i>0&&monthWeek(date)!==monthWeek(dates[i-1])?`<div class="week-divider" role="separator" aria-label="${monthWeek(date)+1}주차 시작"><span>${monthWeek(date)+1}주차</span></div>`:'';
    return `${divider}<div class="chapter-stop stop-${i%6} week-tone-${monthWeek(date)}"><button class="chapter-node day-node ${done?'complete':''}" data-action="open-day" data-date="${date}" ${future?'disabled':''} ${active?'aria-current="date"':''} aria-label="${date} ${done?'묵상 완료':future?'예정':'말씀 선택'}" style="--fill:${dayReadingPercent(date)}%"><span class="node-core">${done?'✓':star()}</span></button><time class="day-caption" datetime="${date}">${dateLabel(date)} <span>(${weekday})</span></time></div>`;
  }).join('')}<div class="path-friends"><img src="assets/friends.png" alt="말씀 여행을 응원하는 뮤니, 코, 타스"></div><div class="path-sprout" aria-hidden="true">🌱</div></div>`;
}
function openDay(date) {
  if(!validDay(date)||date>today)return;
  const saved=CHAPTERS.find(c=>Object.values(record(c.id,date).sessions||{}).some(r=>!r.completed&&(r.read?.length||fields.some(f=>r[f])))) || CHAPTERS.find(c=>record(c.id,date).lastRange) || CHAPTERS[0];
  openChapter(saved.id,undefined,undefined,date);
}
function openChapter(id, start, end, date=today) {
  if (!CHAPTERS.some(c=>c.id===id)||!validDay(date)||date>today) return;
  selectedDate=date; selected=id; stage=0;
  const last=record().lastRange;
  const resume=validRange(chapter(),start,end);
  rangeStart=resume?start:validRange(chapter(),last?.start,last?.end)?last.start:1;
  rangeEnd=resume?end:validRange(chapter(),last?.start,last?.end)?last.end:chapter().verses.length;
  render(resume?'editor':'selection'); window.scrollTo({top:0,behavior:'instant'});
}
function selection() {
  const c=chapter();
  content.innerHTML=`<div class="editor-head"><button class="back" data-page="home" aria-label="말씀 경로로 돌아가기">←</button></div><h1>${selectedDate===today?'오늘의 말씀 선택':dateLabel(selectedDate)+' 말씀 선택'}</h1><form id="passage-selection" class="passage-selection"><label for="chapter-select">말씀</label><select id="chapter-select" name="chapter">${CHAPTERS.map(item=>`<option value="${item.id}" ${item.id===selected?'selected':''}>${item.book} ${item.chapter}장 · ${item.title}</option>`).join('')}</select><div class="range-fields"><div><label for="start-verse">시작 절</label><select id="start-verse" name="start">${c.verses.map((_,i)=>`<option value="${i+1}" ${rangeStart===i+1?'selected':''}>${i+1}절</option>`).join('')}</select></div><span aria-hidden="true">–</span><div><label for="end-verse">끝 절</label><select id="end-verse" name="end">${c.verses.map((_,i)=>i+1).filter(n=>n>=rangeStart).map(n=>`<option value="${n}" ${rangeEnd===n?'selected':''}>${n}절</option>`).join('')}</select></div></div><div class="range-preview" aria-live="polite"><strong>${reference()}</strong><span>${selectedVerses().length}절</span></div><button type="submit" class="primary wide">이 말씀으로 QT 시작하기 →</button></form>`;
}
function readingContext(c, r) {
  const previousField = stage === 2 ? 'observation' : stage === 3 ? 'interpretation' : null;
  const previousLabel = stage === 2 ? '관찰' : '해석';
  const scripture = `<details class="reading-excerpt" ${stage >= 2 ? 'open' : ''}><summary>읽은 말씀 다시 보기 · ${reference(c)}</summary>${selectedVerses().map(n=>`<p><sup>${n}</sup> ${escapeHTML(c.verses[n-1])}</p>`).join('')}</details>`;
  const reflection = previousField ? `<section class="reflection-context" aria-label="나의 ${previousLabel} 다시 보기"><h2>내가 ${previousLabel}한 내용</h2><p>${escapeHTML(r[previousField] || '아직 작성한 내용이 없어요.')}</p></section>` : '';
  return scripture + reflection;
}
function editor() {
  const c=chapter(),r=sessionRecord();
  content.innerHTML=`<div class="editor-head"><button class="back" data-action="reselect" aria-label="말씀 범위 다시 선택">←</button><span>${dateLabel(selectedDate)} · ${reference(c)} · ${c.title}</span><span>${stage+1} / 4</span></div><div class="editor-progress">${[0,1,2,3].map(i=>`<span class="${i<=stage?'filled':''}"></span>`).join('')}</div>${stage===0?`<div class="reading-title"><div><div class="eyebrow">WORD OF THE DAY</div><h1>${reference(c)}</h1><p>${c.title} · 개역한글</p></div><span class="reading-count">${selectedVerses().length}절</span></div><ol class="verses">${selectedVerses().map(n=>`<li class="verse-row"><span class="verse-number" aria-hidden="true">${n}</span><span>${escapeHTML(c.verses[n-1])}</span></li>`).join('')}</ol><button class="primary wide" id="next" data-action="next">말씀을 읽었어요 →</button>`:`<div class="eyebrow">QT JOURNAL · ${reference(c)}</div><h1>${parts[stage-1]}하기</h1>${readingContext(c,r)}<label for="reflection" class="sr-only">나의 ${parts[stage-1]}</label><textarea id="reflection">${escapeHTML(r[fields[stage-1]])}</textarea><div class="actions"><button class="text-button" data-action="previous">← 이전</button><button class="primary" id="next" data-action="next" ${r[fields[stage-1]]?.trim()?'':'disabled'}>${stage===3?'묵상 완료하기 ✓':'다음으로 →'}</button></div>`}`;
}
function journalCard(date,c,r,old=false) {
  const title=old?'이전 말씀 묵상':reference(c,r.start,r.end);
  return `<article class="entry"><small>${date} · ${r.completed?'묵상 완료 ✓':'작성 중'}${old?' · 이전 버전 기록':''}</small><h2>${title}</h2>${fields.map((f,i)=>`<h3>${parts[i]}</h3><p>${escapeHTML(r[f]||'아직 작성하지 않았어요.')}</p>`).join('')}${!old&&date<=today&&CHAPTERS.some(item=>item.id===c.id)?`<button class="text-button" data-chapter="${c.id}" data-start="${r.start}" data-end="${r.end}" data-date="${date}">기록 이어 쓰기 →</button>`:''}</article>`;
}
function journal() {
 const dates=[...new Set([...Object.keys(data),...Object.keys(legacy)])].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
 const cards=dates.map(date=>ALL_CHAPTERS.map(c=>Object.values(record(c.id,date).sessions||{}).filter(r=>validRange(c,r.start,r.end)&&((r.read||[]).length||fields.some(f=>r[f]))).map(r=>journalCard(date,c,r)).join('')).join('')+(legacy[date]&&fields.some(f=>legacy[date][f])?journalCard(date,null,legacy[date],true):'')).join('');
 content.innerHTML=`<div class="eyebrow">MY QUIET TIME</div><h1>나의 묵상</h1><p class="intro">한 장의 말씀, 나만의 이야기.</p><button class="outline-button" data-action="export">↓ 전체 기록 백업</button>${cards||'<div class="empty">📖<p>아직 기록이 없어요.<br>말씀 여행에서 첫 장을 열어 보세요.</p><button class="primary" data-page="home">말씀 읽으러 가기</button></div>'}`;
}
function activity() {const dates=[...new Set([...Object.keys(data),...Object.keys(legacy)])].filter(completedDay);content.innerHTML=`<div class="eyebrow">MY JOURNEY</div><h1>말씀과 걸어온 발자국</h1><div class="activity-stats"><section class="card"><span>🔥</span><h2>${streak()}일</h2><p>연속 묵상</p></section><section class="card"><span>💎</span><h2>${allTimeCount()}절</h2><p>그동안 읽은 말씀</p></section><section class="card"><span>🏅</span><h2>${dates.length}일</h2><p>전체 묵상 일수</p></section></div><h2>오늘의 장별 읽기</h2>${CHAPTERS.map(c=>`<button class="chapter-summary" data-chapter="${c.id}"><span>${c.book} ${c.chapter}장 <small>${c.title}</small></span><b>${readVerses(c.id).length} / ${c.verses.length}절 →</b></button>`).join('')}`;}
function success() {content.innerHTML=`<section class="success"><div class="eyebrow">WELL DONE!</div><div class="medal">🏅</div><h1>말씀을 마음에 심었어요!</h1><p>${reference()} · ${selectedVerses().length}절 묵상 완료<br>오늘의 작은 실천을 응원해요.</p><img src="assets/friends.png" alt="축하하는 뮤니, 코, 타스"><section class="card"><h3>🔥 ${streak()}일 연속 묵상</h3><p>읽기 ${readVerses(selected,selectedDate).length} / ${chapter().verses.length}절 · ${readVerses(selected,selectedDate).length===chapter().verses.length?'한 장을 모두 읽었어요!':'남은 말씀도 언제든 이어 읽을 수 있어요.'}</p></section><button class="primary wide" data-page="home">말씀 여행 계속하기</button><button class="text-button" data-page="journal">나의 묵상 보기 →</button></section>`;}
function account() {
  const avatar=AVATARS[profile.avatar];
  const completedDates=[...new Set([...Object.keys(data),...Object.keys(legacy)])].filter(date=>validDay(date)&&date<=today&&completedDay(date));
  content.innerHTML=`<h1>계정</h1><section class="profile-summary"><span class="profile-avatar" aria-hidden="true">${avatar.emoji}</span><div><h2>${escapeHTML(profile.name||'나의 프로필')}</h2><p>이 브라우저에 저장되는 프로필</p></div></section><form id="account-form" class="account-form"><label for="profile-name">이름</label><input id="profile-name" name="name" type="text" maxlength="20" required autocomplete="nickname" value="${escapeHTML(profile.name)}"><fieldset><legend>프로필 캐릭터</legend><div class="avatar-options">${Object.entries(AVATARS).map(([key,value])=>`<label class="avatar-option"><input type="radio" name="avatar" value="${key}" ${profile.avatar===key?'checked':''}><span><i aria-hidden="true">${value.emoji}</i>${value.name}</span></label>`).join('')}</div></fieldset><button type="submit" class="primary wide">프로필 저장</button></form><div class="activity-stats account-stats"><section class="card"><span>🔥</span><h2>${streak()}일</h2><p>연속학습</p></section><section class="card"><span>💎</span><h2>${allTimeCount()}절</h2><p>그동안 읽은 말씀</p></section><section class="card"><span>🏅</span><h2>${completedDates.length}일</h2><p>묵상한 날</p></section></div><button class="outline-button" data-action="export">↓ 전체 기록 백업</button>`;
}
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(!['chapter-select','start-verse','end-verse'].includes(id))return;
  if(id==='chapter-select'){
    selected=e.target.value;const last=record().lastRange;
    rangeStart=validRange(chapter(),last?.start,last?.end)?last.start:1;
    rangeEnd=validRange(chapter(),last?.start,last?.end)?last.end:chapter().verses.length;
  }
  if(id==='start-verse'){rangeStart=Number(e.target.value);rangeEnd=Math.max(rangeStart,rangeEnd);}
  if(id==='end-verse')rangeEnd=Number(e.target.value);
  render('selection');document.getElementById(id).focus();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='account-form'){
    e.preventDefault();const values=new FormData(e.target),name=String(values.get('name')||'').trim(),avatar=String(values.get('avatar')||'');
    if(!name||name.length>20||!Object.hasOwn(AVATARS,avatar))return;
    const nextProfile={name,avatar};
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify(nextProfile));profile=nextProfile;render('account');toast('프로필을 저장했어요.');}
    catch{toast('프로필을 저장할 수 없어요. 브라우저 저장 공간을 확인해 주세요.');}
    return;
  }
  if(e.target.id!=='passage-selection')return;
  e.preventDefault();if(!validRange(chapter(),rangeStart,rangeEnd))return;
  stage=0;render('editor');window.scrollTo({top:0,behavior:'instant'});
});
document.addEventListener('input',e=>{if(e.target.id!=='reflection')return;updateRecord({[fields[stage-1]]:e.target.value});document.querySelector('#next').disabled=!e.target.value.trim();});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.page)render(b.dataset.page);
 if(b.dataset.chapter)openChapter(b.dataset.chapter,Number(b.dataset.start),Number(b.dataset.end),b.dataset.date||today);
 if(b.dataset.action==='open-day')openDay(b.dataset.date);
 if(b.dataset.action==='reselect')render('selection');
 if(b.dataset.action==='previous'){stage--;render('editor');}
 if(b.dataset.action==='next'){
  if(stage===0)updateRecord({read:selectedVerses()});
  if(stage<3){stage++;render('editor');}
  else if(fields.every(f=>sessionRecord()[f]?.trim())&&sessionRecord().read?.length){const ok=updateRecord({completed:true});render('success');if(!ok)toast('기록이 메모리에만 있어요. 파일로 백업해 주세요.');}
  else toast('읽은 절과 관찰·해석·적용을 확인해 주세요.');
 }
 if(b.dataset.action==='export'){const blob=new Blob([JSON.stringify({version:3,exportedAt:new Date().toISOString(),profile,chapters:data,legacyEntries:legacy},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quolingo-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('전체 기록을 파일로 백업했어요.');}
});
function refreshDay(){if(today!==dayKey()){today=dayKey();selectedDate=today;stage=0;render('home');toast('새 하루의 말씀 여행을 시작해요. 이전 기록은 나의 묵상에 있어요.');}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});setInterval(refreshDay,30000);
render();
