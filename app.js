const accountStore = new QuolingoCloud.Store((()=>{
  try{return window.localStorage;}
  catch{return {getItem:()=>null,setItem:()=>{throw new Error('Browser storage unavailable');}};}
})());
let cloudAccount=null;
const KEY = 'quolingo-chapters-v2';
const LEGACY_KEY = 'quolingo-journal-v1';
const PROFILE_KEY = 'quolingo-profile-v1';
const READING_KEY = 'quolingo-reading-v1';
const CHAPTER_BY_ID = new Map(ALL_CHAPTERS.map(c=>[c.id,c]));
const ACTIVE_CHAPTER_IDS = new Set(CHAPTERS.map(c=>c.id));
const AVATARS = {muni:{name:'뮤니',face:'430 0 345 260'},ko:{name:'코',face:'474 397 242 201'},tas:{name:'타스',face:'472 683 244 174'}};
const THEMES = {
  apricot:{name:'살구',color:'#f7b77f',shadow:'#b87848'},
  sunshine:{name:'노랑',color:'#f4d778',shadow:'#b3923f'},
  sand:{name:'베이지',color:'#c6b3a2',shadow:'#90796c'},
  sky:{name:'하늘',color:'#9dc9dc',shadow:'#628f9f'},
  rose:{name:'분홍',color:'#e2a3ad',shadow:'#a26875'},
  lavender:{name:'보라',color:'#b8aad6',shadow:'#817299'}
};
const BIBLE_VERSIONS = BibleReading.names;
const fields = ['observation', 'interpretation', 'application'];
const parts = ['관찰', '해석', '적용'];
const content = document.querySelector('#content');
let readingData = {}, mode = 'qt', openingDayTimer = null, heldButton = null;
let shareSnapshot=null,shareBusy=false,scriptureRequest=0;
let data = {}, legacy = {}, page = 'home', stage = 0, selected = CHAPTERS[0].id;
let rangeStart = 1, rangeEnd = CHAPTERS[0].verses.length;
function load(key) {
  try { const value = JSON.parse(accountStore.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
data = load(KEY); legacy = load(LEGACY_KEY); readingData = load(READING_KEY);
const savedProfile=load(PROFILE_KEY);
const validBookId=id=>BOOKS.some(book=>book.id===id);
function normalizedProfile(value={}) {
  const previousBookId=validBookId(value.bookId)?value.bookId:'joshua';
  return {bibleVersion:Object.hasOwn(BIBLE_VERSIONS,value.bibleVersion)?value.bibleVersion:'krv',name:typeof value.name==='string'?value.name.slice(0,20):'',avatar:Object.hasOwn(AVATARS,value.avatar)?value.avatar:'ko',theme:Object.hasOwn(THEMES,value.theme)?value.theme:'apricot',qtBookId:validBookId(value.qtBookId)?value.qtBookId:previousBookId,readingBookId:validBookId(value.readingBookId)?value.readingBookId:previousBookId,...DailyProgress.settings({...value,completionRule:value.completionRule==='either'?'both':value.completionRule}),decorations:QuolingoDecor.normalize(value.decorations)};
}
let profile=normalizedProfile(savedProfile);
function applyTheme(themeId=profile.theme) {
  const root=document.documentElement,palette=Object.values(THEMES),index=Object.keys(THEMES).indexOf(themeId),theme=palette[index];
  root.dataset.theme=themeId;
  root.style.setProperty('--accent',theme.color);root.style.setProperty('--accent-shadow',theme.shadow);
  palette.forEach((_,i)=>{const tone=palette[(index+i)%palette.length];root.style.setProperty(`--week-${i}-color`,tone.color);root.style.setProperty(`--week-${i}-shadow`,tone.shadow);});
  document.querySelector('meta[name="theme-color"]').content=theme.color;
  const manifest=document.querySelector('link[rel=manifest]'),href=themeId==='apricot'?'manifest.webmanifest':`manifest-${themeId}.webmanifest`;
  if(manifest.getAttribute('href')!==href)manifest.setAttribute('href',href);
}
applyTheme();
// Keep existing chapter journals as full-chapter sessions; retain original fields.
function migrateQTEntries() {
for (const day of Object.values(data)) {
  for (const c of ALL_CHAPTERS) {
    const entry = day?.[c.id];
    if (!entry || typeof entry !== 'object' || entry.sessions) continue;
    const previous = Object.fromEntries(fields.map(f => [f, entry[f] || '']));
    entry.sessions = {[`1-${c.verses.length}`]: {...previous, start:1, end:c.verses.length,
      read:Array.isArray(entry.read) ? [...entry.read] : [], completed:Boolean(entry.completed)}};
  }
}
}
migrateQTEntries();
function dayKey(date = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function shiftDay(key, n) { const date = new Date(key + 'T12:00:00+09:00'); date.setUTCDate(date.getUTCDate() + n); return dayKey(date); }
let today = dayKey();
let selectedDate = today;
let activityMonth = today.slice(0,7), activityDate = today;
function qtBook() { return BOOKS.find(b=>b.id===profile.qtBookId)||BOOKS[0]; }
function qtChapters() { return qtBook().chapters; }
function readingBook() { return BOOKS.find(b=>b.id===profile.readingBookId)||BOOKS[0]; }
function readingChapters() { return readingBook().chapters; }
function selectionChapters() { return BOOKS.find(b=>b.chapters.some(c=>c.id===selected))?.chapters||qtChapters(); }
function chapter() { return CHAPTER_BY_ID.get(selected)||readingChapters()[0]; }
function chapterLabel(c) { return `${c.book} ${c.chapter}장${c.title?' · '+c.title:''}`; }
function bookOptions(selectedBookId) {
  return [['old','구약'],['new','신약']].map(([testament,label])=>`<optgroup label="${label}">${BOOKS.filter(b=>b.testament===testament).map(b=>`<option value="${b.id}" ${b.id===selectedBookId?'selected':''}>${b.name}</option>`).join('')}</optgroup>`).join('');
}
function record(id = selected, date = selectedDate) { return data[date]?.[id] || {}; }
function readVerses(id = selected, date = today) {
  const c = CHAPTER_BY_ID.get(id);
  if(!c)return [];
  return [...new Set(Array.isArray(record(id,date).read) ? record(id,date).read : [])].filter(n => Number.isInteger(n) && n >= 1 && n <= BibleReading.maxCount(c)).sort((a,b) => a-b);
}
function rangeKey() { return `${rangeStart}-${rangeEnd}`; }
function sessionRecord() { return record().sessions?.[rangeKey()] || {}; }
function selectedVerses() { return Array.from({length:rangeEnd-rangeStart+1}, (_,i)=>rangeStart+i); }
function reference(c = chapter(), start = rangeStart, end = rangeEnd) {
  return `${c.book} ${c.chapter}:${start}${start===end?'':'–'+end}`;
}
function validRange(c, start, end, version) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= (version?BibleReading.count(c,version):BibleReading.maxCount(c));
}
function updateRecord(changes) {
  rememberDailyRules(selectedDate);
  const entry = record();
  const session = {...sessionRecord(), start:rangeStart, end:rangeEnd, ...changes};
  const read = changes.read ? [...new Set([...readVerses(selected,selectedDate), ...changes.read])].sort((a,b)=>a-b) : readVerses(selected,selectedDate);
  data[selectedDate] = {...data[selectedDate], [selected]: {...entry, read, lastRange:{start:rangeStart,end:rangeEnd},
    sessions:{...entry.sessions, [rangeKey()]:session}}};
  try { accountStore.setItem(KEY, JSON.stringify(data));rememberCompletion(selectedDate);return true; }
  catch { toast('기기에 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); return false; }
}
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
function qtCompletedDay(date) { return Boolean(legacy[date]?.completed || Object.values(data[date]||{}).some(entry => entry?.completed || Object.values(entry?.sessions || {}).some(r=>r?.completed))); }
function readChapters(date=today) { return [...new Set(Array.isArray(readingData[date]?.chapters)?readingData[date].chapters:[])].filter(id=>ACTIVE_CHAPTER_IDS.has(id)); }
function daySettings(date, referenceProfile=profile) {
  if(date===today)return DailyProgress.settings(referenceProfile);
  if(readingData[date]?.rules)return DailyProgress.settings(readingData[date].rules);
  // Older completed QT days keep their original completion rule.
  return DailyProgress.settings(qtCompletedDay(date)?{}:referenceProfile);
}
function dailyState(date) { return DailyProgress.state(date,qtCompletedDay(date),readChapters(date).length,daySettings(date),readingData[date]?.completedRules); }
function completedDay(date) { return dailyState(date).complete; }
function streak() { return DailyProgress.streak(today,dailyState,shiftDay); }
function persistReading() {
  try { accountStore.setItem(READING_KEY,JSON.stringify(readingData)); return true; }
  catch { toast('말씀 읽기 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); return false; }
}
function rememberDailyRules(date) {
  if(!readingData[date]?.rules) { readingData[date]={...readingData[date],rules:daySettings(date)};persistReading(); }
}
function withCompletionRules(date, entry={}, rules=daySettings(date)) {
  const config=DailyProgress.settings(rules);
  const count=[...new Set(Array.isArray(entry.chapters)?entry.chapters:[])].filter(id=>ACTIVE_CHAPTER_IDS.has(id)).length;
  if(!DailyProgress.state(date,qtCompletedDay(date),count,config).complete)return entry;
  const completed=Array.isArray(entry.completedRules)?entry.completedRules.filter(rule=>rule&&typeof rule==='object'&&!Array.isArray(rule)):[];
  if(completed.some(rule=>JSON.stringify(DailyProgress.settings(rule))===JSON.stringify(config)))return entry;
  return {...entry,completedRules:[...completed,config]};
}
function rememberCompletion(date) {
  const entry=readingData[date]||{},next=withCompletionRules(date,entry);
  if(next!==entry){readingData={...readingData,[date]:next};persistReading();}
}
function commitProfile(nextProfile, previousProfile=profile) {
  const nextReading={...readingData};
  // Seal historical rules before changing the profile, including records from older versions.
  const dates=new Set([...Object.keys(data),...Object.keys(legacy),...Object.keys(readingData)].filter(date=>validDay(date)&&date<=today));
  const earliest=[...dates].sort()[0]||today,limit=shiftDay(today,-39999);
  // Rest days have no entries, but must retain their old Sunday exemption as well.
  for(let date=earliest<limit?limit:earliest;date<=today;date=shiftDay(date,1))dates.add(date);
  for(const date of dates) {
    const rules=daySettings(date,previousProfile);
    nextReading[date]=withCompletionRules(date,{...readingData[date],rules:readingData[date]?.rules||rules},rules);
  }
  const rules=DailyProgress.settings(nextProfile);
  nextReading[today]=withCompletionRules(today,{...nextReading[today],rules},rules);
  const previousReading=accountStore.getItem(READING_KEY)||'{}';
  accountStore.setItem(READING_KEY,JSON.stringify(nextReading));
  try {accountStore.setItem(PROFILE_KEY,JSON.stringify(nextProfile));}
  catch(error){try{accountStore.setItem(READING_KEY,previousReading);}catch{}throw error;}
  readingData=nextReading;profile=nextProfile;
}
function setChapterRead(id=selected,date=selectedDate,read=true) {
  if(!ACTIVE_CHAPTER_IDS.has(id)||!validDay(date)||date>today)return;
  const chapters=readChapters(date),counts={...readingData[date]?.chapterVerseCounts};
  if(read)counts[id]=BibleReading.count(CHAPTER_BY_ID.get(id),profile.bibleVersion);else delete counts[id];
  const next={...readingData,[date]:{...readingData[date],rules:readingData[date]?.rules||daySettings(date),
    chapters:read?[...new Set([...chapters,id])]:chapters.filter(item=>item!==id),chapterVerseCounts:counts}};
  next[date]=withCompletionRules(date,next[date]);
  try { accountStore.setItem(READING_KEY,JSON.stringify(next)); }
  catch { toast('읽기 기록을 저장할 수 없어요. 다시 시도해 주세요.');return; }
  readingData=next;render(page);
  if(page==='reader')document.querySelector('[data-action="read-chapter"]').focus({preventScroll:true});
  if(!read)toast('읽기 완료를 취소했어요.');
}
function completedQTVerses(id, date) {
  const c=CHAPTER_BY_ID.get(id);
  if(!c)return [];
  const sessions=Object.values(record(id,date).sessions||{}).filter(r=>r?.completed&&validRange(c,r.start,r.end));
  return [...new Set(sessions.flatMap(r=>(Array.isArray(r.read)?r.read:Array.from({length:r.end-r.start+1},(_,i)=>r.start+i))
    .filter(n=>Number.isInteger(n)&&n>=r.start&&n<=r.end)))];
}
function qtVerseCount(date) { return ALL_CHAPTERS.reduce((sum,c)=>sum+completedQTVerses(c.id,date).length,0); }
function dateReadCount(date) {
  return qtVerseCount(date)+readChapters(date).reduce((sum,id)=>{const c=CHAPTER_BY_ID.get(id),count=readingData[date]?.chapterVerseCounts?.[id];return sum+(Number.isInteger(count)&&count>=1&&count<=BibleReading.maxCount(c)?count:c.verses.length);},0);
}
function todayCount() { return dateReadCount(today); }
function allTimeCount() {
  return [...new Set([...Object.keys(data),...Object.keys(readingData)])].filter(date=>validDay(date)&&date<=today).reduce((sum,date)=>sum+dateReadCount(date),0);
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
function dayQTPercent(date) {
  if(qtCompletedDay(date))return 100;
  const steps=ALL_CHAPTERS.flatMap(c=>Object.values(record(c.id,date).sessions||{}).filter(r=>validRange(c,r.start,r.end)).map(DailyProgress.qtSteps));
  return Math.max(0,...steps)*25;
}
function toast(message) { const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500); }
function updateStats() {
  const count=allTimeCount(), days=streak();
  document.querySelectorAll('[data-stat="streak"]').forEach(el=>el.textContent=days);
  document.querySelectorAll('[data-stat="total"]').forEach(el=>{el.textContent=count;el.closest('.diamond-stat')?.setAttribute('aria-label',`그동안 읽은 말씀 ${count}절`);});
  document.querySelector('.sidebar-friend').innerHTML=friendsArt('손을 흔들며 인사하는 뮤니, 코, 타스');
  document.querySelectorAll('[data-profile-avatar]').forEach(el=>el.innerHTML=avatarFace(profile.avatar));
  const weekday=new Date(today+'T12:00:00+09:00').getUTCDay();const monday=shiftDay(today,-((weekday+6)%7));
  document.querySelector('#week').innerHTML=['월','화','수','목','금','토','일'].map((label,i)=>{
    const date=shiftDay(monday,i),state=dailyState(date),done=state.complete;
    return `<div class="day ${date===today?'today':''} ${done?'checked':''}" data-date="${date}" aria-label="${date} ${label}요일 ${done?'완료':state.rest?'QT 쉬는 날':'미완료'}"><span>${label}</span><i aria-hidden="true">${done?checkMark():state.rest?'–':'·'}</i></div>`;
  }).join('');
  const goal=profile.dailyGoal,read=readChapters().length;
  document.querySelector('#reading-goal').innerHTML=`<div class="card-heading"><h3>오늘의 말씀 목표</h3><span>📖</span></div><p class="goal-count"><strong>${read}</strong> / ${goal}장</p><p class="goal-label">목표 ${goal}장 · 오늘 ${read}장 읽음</p><progress max="${goal}" value="${Math.min(read,goal)}" aria-label="오늘 말씀 읽기 ${read}장, 목표 ${goal}장"></progress>`;
}
let lastRoute=null;
const routeScrolls=new Map();
function routeState(target=page) {
  return {page:target,mode,stage,selected,selectedDate,rangeStart,rangeEnd,activityMonth,activityDate,owner:accountStore.owner};
}
function routeKey(route) { return JSON.stringify(route); }
function restoreRoute(route) {
  if((route?.owner||null)!==accountStore.owner)return false;
  if(!route||!['home','selection','wordSelection','reader','editor','journal','activity','success','account','customize'].includes(route.page)||!CHAPTER_BY_ID.has(route.selected)||!validDay(route.selectedDate)||route.selectedDate>today)return false;
  if(!Number.isInteger(route.stage)||route.stage<0||route.stage>3)return false;
  if(['editor','selection','success'].includes(route.page)&&!validRange(CHAPTER_BY_ID.get(route.selected),route.rangeStart,route.rangeEnd))return false;
  if(!validDay(route.activityMonth+'-01')||!validDay(route.activityDate)||route.activityDate>today)return false;
  ({mode,stage,selected,selectedDate,rangeStart,rangeEnd,activityMonth,activityDate}=route);
  return true;
}
function render(target=page,historyMode='auto') {
  const request=++scriptureRequest;
  applyTheme();
  if(target!=='customize')shopPreview=null;
  releaseHeldButton();clearTimeout(openingDayTimer);openingDayTimer=null;
  const route=routeState(target),changed=lastRoute&&routeKey(lastRoute)!==routeKey(route);
  if(historyMode!=='none') {
    if(changed&&historyMode!=='replace') {
      routeScrolls.set(routeKey(lastRoute),scrollY);
      history.replaceState({quolingo:lastRoute,scroll:scrollY},'');
      history.pushState({quolingo:route,scroll:0},'');
    } else history.replaceState({quolingo:route,scroll:scrollY},'');
  }
  lastRoute=route;
  page=target;
  const activePage=['editor','selection','wordSelection','reader','success'].includes(page)?'home':page;
  document.querySelectorAll('.nav').forEach(button=>{
    const active=button.dataset.page===activePage;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  const version=profile.bibleVersion,owner=accountStore.owner;
  if(['reader','editor'].includes(page)&&!BibleReading.ready(version)){
    content.innerHTML=`<section class="scripture-status" role="status" aria-busy="true"><p>${BIBLE_VERSIONS[version]} 본문을 불러오고 있어요.</p></section>`;updateStats();
    BibleReading.load(version).then(()=>{
      if(request===scriptureRequest&&version===profile.bibleVersion&&owner===accountStore.owner)render(page,'replace');
    }).catch(()=>{
      if(request!==scriptureRequest||owner!==accountStore.owner)return;
      content.innerHTML='<section class="scripture-status" role="alert"><p>본문을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.</p><button class="primary" data-action="bible-retry">다시 시도</button><button class="text-button" data-page="home">홈으로 돌아가기</button></section>';
    });return;
  }
  ({home,selection,wordSelection,reader,editor,journal,activity,success,account,customize}[page] || home)();updateStats();
}
history.scrollRestoration='manual';
window.addEventListener('popstate',event=>{
  if(lastRoute)routeScrolls.set(routeKey(lastRoute),scrollY);
  if(document.querySelector('#share-dialog').open)closeShare();
  const route=event.state?.quolingo;
  if(!restoreRoute(route))return;
  render(route.page,'none');
  const top=routeScrolls.get(routeKey(route))??event.state.scroll??0;
  requestAnimationFrame(()=>window.scrollTo({top,behavior:'instant'}));
});
function star() { return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 2 4.3 8.7 9.6 1.4-6.9 6.7 1.6 9.5L16 23.8l-8.6 4.5L9 18.8l-6.9-6.7 9.6-1.4Z" fill="currentColor"/></svg>'; }
function checkMark() { return '<svg class="completion-check" viewBox="0 0 40 40" aria-hidden="true"><path d="m8 20 8 8 16-17" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function avatarFace(id,decorations=profile.decorations) {
  const avatar=AVATARS[id]||AVATARS.ko;
  const [,,width,height]=avatar.face.split(' ');
  return `<svg class="avatar-face frame-${decorations.equipped.frame||'default'}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><svg width="${width}" height="${height}" viewBox="${avatar.face}" overflow="hidden"><image href="assets/character-parts.png" width="1536" height="1024"/></svg></svg>`;
}
// Body and waving arm are separate sprite regions, joined at each shoulder.
function friendsArt(label, characterId, decorations=profile.decorations) {
  const members=characterId?(Array.isArray(characterId)?characterId:[characterId]):null;
  const cast = [
    {id:'muni',view:'-20 -30 500 470',body:[380,0,390,400],arm:[912,126,192,181],joint:[300,250],offset:[-38,-154]},
    {id:'ko',view:'-20 -40 390 365',body:[474,397,242,291],arm:[906,474,166,150],joint:[185,218],offset:[-34,-126]},
    {id:'tas',view:'-10 -40 470 420',body:[413,690,340,334],arm:[904,747,194,185],joint:[300,170],offset:[-36,-155]}
  ];
  const sprite=(region,x=0,y=0)=>`<svg x="${x}" y="${y}" width="${region[2]}" height="${region[3]}" viewBox="${region.join(' ')}" overflow="hidden"><image href="assets/character-parts.png" width="1536" height="1024"/></svg>`;
  return `<div class="friends-cast ${members?(members.length===1?'solo':'duo'):''}" role="img" aria-label="${escapeHTML(label)}">${(members?members.map(id=>cast.find(c=>c.id===id)):cast).map(c=>`<svg class="friend-character friend-${c.id}" viewBox="${c.view}" aria-hidden="true" focusable="false"><g class="friend-motion"><g transform="translate(${c.joint.join(' ')})"><g class="friend-hand">${sprite(c.arm,...c.offset)}</g></g>${sprite(c.body)}${characterAccessory(c.id,decorations.equipped[c.id])}</g></svg>`).join('')}</div>`;
}
function home() {
  const dates=monthDates(),groups=[];
  for(const date of dates){const week=monthWeek(date);if(!groups[week])groups[week]=[];groups[week].push(date);}
  const currentBook=mode==='qt'?qtBook():readingBook();
  const month=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long'}).format(new Date(today+'T12:00:00+09:00'));
  content.innerHTML=`<section class="unit"><div><small>${currentBook.name}</small><h1>${month}</h1></div></section><div class="mode-tabs" role="group" aria-label="읽기 방식"><button data-action="mode" data-mode="qt" aria-pressed="${mode==='qt'}">QT</button><button data-action="mode" data-mode="reading" aria-pressed="${mode==='reading'}">말씀</button></div><section class="home-decoration" aria-label="나의 꾸민 공간">${decoratedScene()}</section><p class="mobile-goal">오늘 말씀 ${readChapters().length} / 목표 ${profile.dailyGoal}장</p><div class="chapter-path month-path">${groups.map((weekDates,week)=>{
    const order=['ko','muni','tas'],friend=order[week%3],side=week%2===0?'right':'left';
    const members=week%3===1?[friend,order[(week+1)%3]]:[friend],middle=Math.floor((weekDates.length-1)/2);
    return `<section class="path-week ${week%2?'reverse':''}" data-week="${week+1}" aria-label="${week+1}주차"><div class="week-divider" role="separator" aria-label="${week+1}주차 시작"><span>${week+1}주차</span></div>${weekDates.map((date,i)=>{
      const state=dailyState(date),done=mode==='qt'?qtCompletedDay(date):state.readingDone,active=date===today,future=date>today,qtOff=mode==='qt'&&state.qtOff;
      const weekday=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',weekday:'short'}).format(new Date(date+'T12:00:00+09:00'));
      const companion=i===middle?`<div class="week-companion companion-${side} ${members.length>1?'has-duo':''}" data-character="${friend}" data-preferred-side="${side}" data-side="${side}">${friendsArt(`${week+1}주차 · 인사하는 ${members.map(id=>AVATARS[id].name).join(', ')}`,members)}</div>`:'';
      return `<div class="chapter-stop stop-${i%6} week-tone-${week} ${i===middle?'has-companion':''}"><button class="chapter-node day-node ${done?'complete':''}" data-action="open-day" data-date="${date}" ${future||qtOff?'disabled':''} ${active?'aria-current="date"':''} aria-label="${date} ${qtOff?'QT 쉬는 날':done?(mode==='qt'?'QT 완료':'말씀 목표 완료'):future?'예정':mode==='qt'?'QT 말씀 선택':'읽을 말씀 선택'}" style="--fill:${mode==='qt'?dayQTPercent(date):Math.min(100,readChapters(date).length/daySettings(date).dailyGoal*100)}%"><span class="node-core">${done?checkMark():star()}</span></button><time class="day-caption" datetime="${date}">${dateLabel(date)} <span>(${weekday})</span></time>${companion}</div>`;
    }).join('')}</section>`;
  }).join('')}</div>`;
  positionCompanions();
}
function positionCompanions() {
  document.querySelectorAll('.week-companion').forEach(companion=>{
    const path=companion.closest('.month-path').getBoundingClientRect();
    const button=companion.parentElement.querySelector('.day-node').getBoundingClientRect();
    const left=Math.max(0,button.left-path.left),right=Math.max(0,path.right-button.right);
    const side=companion.dataset.preferredSide;
    const inset=Math.min(18,path.width*.03),gap=28;
    const available=(side==='left'?left:right)-gap-inset;
    const width=Math.min(172,Math.max(112,innerWidth*.31),Math.max(0,available));
    const parent=companion.parentElement.getBoundingClientRect();
    const x=side==='left'?path.left+inset:path.right-inset-width;
    companion.classList.toggle('companion-left',side==='left');companion.classList.toggle('companion-right',side==='right');
    companion.dataset.side=side;companion.style.width=width+'px';
    companion.style.left=(x-parent.left)+'px';companion.style.right='auto';
  });
}
window.addEventListener('resize',positionCompanions);
function qtPassageDefault(date) {
  const allowed=new Set(qtChapters().map(c=>c.id));
  const candidates=(day,preferDraft=false)=>Object.entries(data[day]||{}).reverse().flatMap(([id,entry])=>{
    if(!allowed.has(id))return [];
    const c=CHAPTER_BY_ID.get(id),sessions=Object.values(entry?.sessions||{}).filter(r=>validRange(c,r?.start,r?.end)&&
      (r.completed||r.completedSteps>0||r.read?.length||fields.some(field=>String(r[field]||'').trim())));
    const last=sessions.find(r=>r.start===entry.lastRange?.start&&r.end===entry.lastRange?.end)||sessions.at(-1);
    const recent=preferDraft&&last?.completed?sessions.filter(r=>!r.completed).at(-1)||last:last;
    return recent?[{id,start:recent.start,end:recent.end,unfinished:!recent.completed}]:[];
  });
  const current=candidates(date,true);
  if(current.length)return current.find(passage=>passage.unfinished)||current[0];
  for(const day of Object.keys(data).filter(day=>validDay(day)&&day<date).sort().reverse()){
    const previous=candidates(day);if(previous.length)return previous[0];
  }
  return {id:qtChapters()[0].id};
}
function openDay(date) {
  if(!validDay(date)||date>today)return;
  if(mode==='reading'){selectedDate=date;selected=(readingChapters().find(c=>!readChapters(date).includes(c.id))||readingChapters()[0]).id;render('wordSelection');window.scrollTo({top:0,behavior:'instant'});return;}
  if(dailyState(date).qtOff)return;
  const saved=qtPassageDefault(date);
  openChapter(saved.id,undefined,undefined,date,saved);
}
function openChapter(id, start, end, date=today, prefill=null) {
  if (!CHAPTERS.some(c=>c.id===id)||!validDay(date)||date>today) return;
  if(dailyState(date).qtOff){toast('일요일은 QT 쉬는 날이에요.');return;}
  selectedDate=date; selected=id; stage=0;
  const last=prefill&&validRange(chapter(),prefill.start,prefill.end)?prefill:record().lastRange;
  const resume=validRange(chapter(),start,end);
  rangeStart=resume?start:validRange(chapter(),last?.start,last?.end)?last.start:1;
  rangeEnd=resume?end:validRange(chapter(),last?.start,last?.end,profile.bibleVersion)?last.end:BibleReading.count(chapter(),profile.bibleVersion);
  render(resume?'editor':'selection'); window.scrollTo({top:0,behavior:'instant'});
}
function selection() {
  const c=chapter(),length=BibleReading.count(c,profile.bibleVersion);
  rangeStart=Math.min(rangeStart,length);rangeEnd=Math.min(Math.max(rangeStart,rangeEnd),length);
  content.innerHTML=`<h1>${selectedDate===today?'오늘의 말씀 선택':dateLabel(selectedDate)+' 말씀 선택'}</h1><form id="passage-selection" class="passage-selection"><label for="chapter-select">말씀</label><select id="chapter-select" name="chapter">${selectionChapters().map(item=>`<option value="${item.id}" ${item.id===selected?'selected':''}>${chapterLabel(item)}</option>`).join('')}</select><div class="range-fields"><div><label for="start-verse">시작 절</label><select id="start-verse" name="start">${Array.from({length},(_,i)=>`<option value="${i+1}" ${rangeStart===i+1?'selected':''}>${i+1}절</option>`).join('')}</select></div><span aria-hidden="true">–</span><div><label for="end-verse">끝 절</label><select id="end-verse" name="end">${Array.from({length},(_,i)=>i+1).filter(n=>n>=rangeStart).map(n=>`<option value="${n}" ${rangeEnd===n?'selected':''}>${n}절</option>`).join('')}</select></div></div><div class="range-preview" aria-live="polite"><strong>${reference()}</strong><span>${selectedVerses().length}절</span></div><div class="actions"><button type="button" class="outline-button" data-page="home">이전</button><button type="submit" class="primary">다음</button></div></form>`;
}
function wordSelection() {
  content.innerHTML=`<h1>${dateLabel(selectedDate)} 말씀 읽기</h1><form id="word-selection" class="passage-selection"><label for="word-chapter">말씀</label><select id="word-chapter" name="chapter">${selectionChapters().map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${chapterLabel(c)}${readChapters(selectedDate).includes(c.id)?' ✓':''}</option>`).join('')}</select><div class="actions"><button type="button" class="outline-button" data-page="home">이전</button><button class="primary" type="submit">다음</button></div></form>`;
}
function scriptureContent(c,start=1,end=BibleReading.count(c,profile.bibleVersion),context=false) {
  const version=profile.bibleVersion,rows=BibleReading.rows(c,version,start,end);
  const label=row=>row.start===row.end?String(row.start):`${row.start}–${row.end}`;
  const text=row=>escapeHTML(row.text===null?'(이 파일에 해당 절의 본문이 없습니다.)':row.text);
  const headings=start===1?BibleReading.headings(c,version).map(text=>`<p class="scripture-heading">${escapeHTML(text)}</p>`).join(''):'';
  return headings+(context?rows.map(row=>`<p><sup>${label(row)}</sup> ${text(row)}</p>`).join(''):
    `<ol class="verses">${rows.map(row=>`<li class="verse-row"><span class="verse-number" aria-hidden="true">${label(row)}</span><span>${text(row)}</span></li>`).join('')}</ol>`);
}

function reader() {
  const c=chapter(),done=readChapters(selectedDate).includes(selected),chapters=selectionChapters(),index=chapters.findIndex(item=>item.id===selected),previous=chapters[index-1],next=chapters[index+1];
  content.innerHTML=`<div class="editor-head"><span>${dateLabel(selectedDate)} · 말씀 읽기</span></div><h1><button class="chapter-title" data-action="word-reselect" aria-label="${c.book} ${c.chapter}장 · 읽을 장 선택">${c.book} ${c.chapter}장</button></h1><p class="bible-version-name">${BIBLE_VERSIONS[profile.bibleVersion]}</p>${scriptureContent(c)}<button class="primary wide read-toggle" data-action="read-chapter" aria-pressed="${done}" aria-label="${c.book} ${c.chapter}장 ${done?'읽기 완료 취소':'읽기 완료'}">이 장 읽기 완료</button><div class="actions chapter-navigation"><button class="outline-button" data-action="previous-chapter" data-next="${previous?.id||''}" ${previous?'':'disabled'}>이전 장</button><button class="outline-button" data-action="next-chapter" data-next="${next?.id||''}" ${next?'':'disabled'}>다음 장</button></div>`;
}
function readingContext(c, r) {
  const previousField = stage === 2 ? 'observation' : stage === 3 ? 'interpretation' : null;
  const previousLabel = stage === 2 ? '관찰' : '해석';
  const scripture = `<details class="reading-excerpt"><summary>읽은 말씀 다시 보기 · ${reference(c)}</summary>${scriptureContent(c,rangeStart,rangeEnd,true)}</details>`;
  const reflection = previousField ? `<section class="reflection-context" aria-label="나의 ${previousLabel} 다시 보기"><h2>내가 ${previousLabel}한 내용</h2><p>${escapeHTML(r[previousField] || '아직 작성한 내용이 없어요.')}</p></section>` : '';
  return scripture + reflection;
}
function editor() {
  const c=chapter(),r=sessionRecord();
  content.innerHTML=`<div class="editor-head"><button class="passage-title" data-action="reselect" aria-label="${reference(c)} · 말씀 선택">${dateLabel(selectedDate)} · ${reference(c)}</button><span>${stage+1} / 4</span></div><div class="editor-progress">${[0,1,2,3].map(i=>`<span class="${i<=stage?'filled':''}"></span>`).join('')}</div>${stage===0?`<div class="reading-title"><div><div class="eyebrow">WORD OF THE DAY</div><h1>${reference(c)}</h1><p>${c.title?c.title+' · ':''}${BIBLE_VERSIONS[profile.bibleVersion]}</p></div><span class="reading-count">${selectedVerses().length}절</span></div>${scriptureContent(c,rangeStart,rangeEnd)}<div class="actions"><button class="outline-button" data-action="previous">이전</button><button class="primary" id="next" data-action="next">다음</button></div>`:`<div class="eyebrow">QT JOURNAL · ${reference(c)}</div><h1>${parts[stage-1]}하기</h1>${readingContext(c,r)}<label for="reflection" class="sr-only">나의 ${parts[stage-1]}</label><textarea id="reflection">${escapeHTML(r[fields[stage-1]])}</textarea><div class="actions"><button class="outline-button" data-action="previous">이전</button><button class="primary" id="next" data-action="next" ${r[fields[stage-1]]?.trim()?'':'disabled'}>${stage===3?'묵종 완료하기':'다음'}</button></div>`}`;
}
function journalCard(date,c,r,old=false) {
  const title=old?'이전 말씀 묵종':reference(c,r.start,r.end);
  return `<article class="entry"><small>${date} · ${r.completed?'묵종 완료':'작성 중'}${old?' · 이전 버전 기록':''}</small><h2>${title}</h2>${fields.map((f,i)=>`<h3>${parts[i]}</h3><p>${escapeHTML(r[f]||'아직 작성하지 않았어요.')}</p>`).join('')}${!old&&date<=today&&CHAPTERS.some(item=>item.id===c.id)?`<button class="text-button" data-chapter="${c.id}" data-start="${r.start}" data-end="${r.end}" data-date="${date}">이어쓰기</button>`:''}${!old&&r.completed?`<button class="text-button entry-share" data-action="share-entry" data-share-chapter="${c.id}" data-start="${r.start}" data-end="${r.end}" data-date="${date}">공유하기</button>`:''}<button class="text-button entry-delete" data-action="delete-entry" data-delete-chapter="${old?'':c.id}" data-start="${old?'':r.start}" data-end="${old?'':r.end}" data-date="${date}" data-legacy="${old}">묵종 삭제</button></article>`;
}
function deleteJournalEntry({id,date,start,end,old=false}) {
  if(!validDay(date))return;
  const c=CHAPTER_BY_ID.get(id),key=`${start}-${end}`;
  if(old?!legacy[date]:!c||!validRange(c,start,end)||!record(id,date).sessions?.[key])return;
  if(!window.confirm('이 묵종을 삭제할까요? 삭제한 내용은 되돌릴 수 없어요.'))return;
  if(old) {
    const next={...legacy};delete next[date];
    try {accountStore.setItem(LEGACY_KEY,JSON.stringify(next));}
    catch {toast('묵종을 삭제하지 못했어요. 다시 시도해 주세요.');return;}
    legacy=next;
  } else {
    const next={...data,[date]:{...data[date]}},sessions={...record(id,date).sessions};
    delete sessions[key];
    if(Object.keys(sessions).length) {
      // Drop migrated chapter-wide completion flags and rebuild from the remaining ranges.
      const last=Object.values(sessions).find(r=>validRange(c,r.start,r.end));
      next[date][id]={sessions,read:[...new Set(Object.values(sessions).flatMap(r=>Array.isArray(r.read)?r.read:[]))].sort((a,b)=>a-b),
        ...(last?{lastRange:{start:last.start,end:last.end}}:{})};
    } else delete next[date][id];
    if(!Object.keys(next[date]).length)delete next[date];
    try {accountStore.setItem(KEY,JSON.stringify(next));}
    catch {toast('묵종을 삭제하지 못했어요. 다시 시도해 주세요.');return;}
    data=next;
  }
  render('journal','replace');toast('묵종을 삭제했어요.');
}
function journal() {
 const dates=[...new Set([...Object.keys(data),...Object.keys(legacy),...Object.keys(readingData)])].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
 const cards=dates.map(date=>ALL_CHAPTERS.map(c=>Object.values(record(c.id,date).sessions||{}).filter(r=>validRange(c,r.start,r.end)&&((r.read||[]).length||fields.some(f=>r[f]))).map(r=>journalCard(date,c,r)).join('')).join('')+(legacy[date]&&fields.some(f=>legacy[date][f])?journalCard(date,null,legacy[date],true):'')).join('');
 content.innerHTML=`<div class="eyebrow">MY QUIET TIME</div><h1>나의 묵종</h1><p class="intro">한 장의 말씀, 나만의 이야기.</p>${cards||'<div class="empty">📖<p>아직 기록이 없어요.<br>홈에서 첫 말씀을 열어 보세요.</p><button class="primary" data-page="home">말씀 읽으러 가기</button></div>'}`;
}
function readingDates() {
  return Object.keys(readingData).filter(date=>validDay(date)&&date<=today).sort();
}
function activityCalendar() {
  const dates=monthDates(activityMonth+'-01'),elapsed=dates.filter(date=>date<=today);
  const offset=(new Date(dates[0]+'T12:00:00+09:00').getUTCDay()+6)%7;
  const monthLabel=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long'}).format(new Date(dates[0]+'T12:00:00+09:00'));
  const completed=elapsed.filter(completedDay).length,qt=elapsed.filter(qtCompletedDay).length;
  const chapters=elapsed.reduce((sum,date)=>sum+readChapters(date).length,0);
  return `<section class="card activity-calendar" aria-labelledby="calendar-title"><div class="calendar-heading"><h2 id="calendar-title">${monthLabel}</h2><div class="calendar-navigation"><button class="text-button" data-action="activity-month" data-shift="-1" aria-label="이전 달">이전 달</button><button class="text-button" data-action="activity-month" data-shift="1" ${activityMonth>=today.slice(0,7)?'disabled':''} aria-label="다음 달">다음 달</button></div></div><div class="month-totals"><span>완료 <strong>${completed}일</strong></span><span>QT <strong>${qt}일</strong></span><span>말씀 <strong>${chapters}장</strong></span></div><div class="calendar-grid" role="group" aria-label="${monthLabel} 읽기 달력">${['월','화','수','목','금','토','일'].map(label=>`<span class="calendar-weekday" aria-hidden="true">${label}</span>`).join('')}${'<span class="calendar-blank" aria-hidden="true"></span>'.repeat(offset)}${dates.map(date=>{
    const state=dailyState(date),qtDone=qtCompletedDay(date),count=readChapters(date).length,future=date>today;
    const status=state.complete?'완료':state.rest?'QT 쉬는 날':'미완료';
    return `<button class="calendar-day ${state.complete?'is-complete':''}" data-action="activity-date" data-date="${date}" aria-label="${dateLabel(date)}, ${status}, QT ${qtDone?'완료':'미완료'}, 말씀 ${count}장" aria-pressed="${date===activityDate}" ${date===today?'aria-current="date"':''} ${future?'disabled':''}><time datetime="${date}">${Number(date.slice(8))}</time><span class="calendar-completion" aria-hidden="true">${state.complete?checkMark():state.rest?'–':''}</span><span class="calendar-reading" aria-hidden="true">${qtDone?'QT':''}${qtDone&&count?' · ':''}${count?count+'장':''}</span></button>`;
  }).join('')}</div><p class="calendar-legend">체크: 완료 · QT: 묵종 완료 · 장: 말씀 읽기</p><section class="calendar-detail" aria-live="polite"><h3>${dateLabel(activityDate)}</h3><p>QT ${qtCompletedDay(activityDate)?'완료':dailyState(activityDate).qtOff?'쉬는 날':'미완료'} · 말씀 ${readChapters(activityDate).length} / 목표 ${daySettings(activityDate).dailyGoal}장</p>${readChapters(activityDate).length?`<ul class="daily-reading-list">${readChapters(activityDate).map(id=>{
    const c=CHAPTER_BY_ID.get(id);
    return `<li><button class="text-button reading-record" data-action="open-reading" data-reading-id="${id}" data-date="${activityDate}">${c.book} ${c.chapter}장</button></li>`;
  }).join('')}</ul>`:'<p class="no-reading">읽은 장이 없어요.</p>'}</section></section>`;
}
function activity() {
  const dates=[...new Set([...Object.keys(data),...Object.keys(legacy),...Object.keys(readingData)])].filter(date=>validDay(date)&&date<=today&&completedDay(date));
  const readDates=readingDates(),total=readDates.reduce((sum,date)=>sum+readChapters(date).length,0);
  const chapterReads=new Map();
  for(const date of readDates)for(const id of readChapters(date))chapterReads.set(id,(chapterReads.get(id)||0)+1);
  const books=BOOKS.map(book=>{
    const chapters=book.chapters.filter(chapter=>chapterReads.has(chapter.id)).map(chapter=>({chapter,times:chapterReads.get(chapter.id)}));
    const count=chapters.reduce((sum,item)=>sum+item.times,0);
    return {book,count,chapters};
  }).filter(item=>item.count>0);
  content.innerHTML=`<h1>기록</h1><div class="activity-stats"><section class="card"><span>🔥</span><h2>${streak()}일</h2><p>연속학습</p></section><section class="card"><span>💎</span><h2>${allTimeCount()}절</h2><p>그동안 읽은 말씀</p></section><section class="card"><span>🏅</span><h2>${dates.length}일</h2><p>완료 일수</p></section></div>${activityCalendar()}<section class="card book-reading"><h2>말씀 읽기 현황</h2><p>오늘 ${readChapters().length} / 목표 ${profile.dailyGoal}장 · 누적 ${total}장</p>${books.length?`<ul class="book-reading-list">${books.map(({book,count,chapters})=>`<li data-book="${book.id}"><details class="book-reading-detail"><summary><span>${book.name}</span><strong>${count}장</strong></summary><div class="read-chapter-list" aria-label="${book.name} 읽은 장">${chapters.map(({chapter,times})=>`<span class="read-chapter">${chapter.chapter}장${times>1?`<small>${times}회</small>`:''}</span>`).join('')}</div></details></li>`).join('')}</ul><p class="reading-count-note">다른 날에 다시 읽은 장도 누적에 포함해요.</p>`:'<p>아직 읽은 장이 없어요.</p>'}</section>`;
}
function success() {content.innerHTML=`<section class="success"><div class="eyebrow">WELL DONE!</div><div class="medal">🏅</div><h1>말씀을 마음에 심었어요!</h1><p>${reference()} · ${selectedVerses().length}절 묵종 완료<br>오늘의 작은 실천을 응원해요.</p>${friendsArt('손을 흔들며 축하하는 뮤니, 코, 타스')}<section class="card"><h3>🔥 ${streak()}일 연속학습</h3><p>읽기 ${readVerses(selected,selectedDate).length} / ${BibleReading.count(chapter(),profile.bibleVersion)}절 · ${readVerses(selected,selectedDate).length===BibleReading.count(chapter(),profile.bibleVersion)?'한 장을 모두 읽었어요!':'남은 말씀도 언제든 이어 읽을 수 있어요.'}</p></section><button class="primary wide" data-action="open-share">묵종 공유하기</button><button class="outline-button wide success-continue" data-page="home">홈 화면으로 돌아가기</button></section>`;}
function openShare({id=selected,date=selectedDate,start=rangeStart,end=rangeEnd}={}) {
  const c=CHAPTER_BY_ID.get(id),r=record(id,date).sessions?.[`${start}-${end}`];
  if(!c||!validDay(date)||!validRange(c,start,end)||!r?.completed){toast('완료한 묵종만 공유할 수 있어요.');return;}
  shareSnapshot={date,reference:reference(c,start,end),...Object.fromEntries(fields.map(field=>[field,String(r[field]||'')]))};
  const nativeShare=typeof navigator.share==='function';
  document.querySelector('#share-application').checked=true;
  document.querySelector('[data-action="send-share"]').textContent=nativeShare?'공유하기':'내용 복사하기';
  document.querySelector('[data-action="copy-share"]').hidden=!nativeShare;
  document.querySelector('#share-note').textContent=nativeShare?'':'내용을 복사해 카카오톡 등에 붙여넣어 공유할 수 있어요.';
  document.querySelector('#share-note').hidden=nativeShare;
  document.querySelector('#share-feedback').textContent='';
  updateSharePreview();setShareBusy(false);
  document.querySelector('#share-dialog').showModal();document.body.classList.add('sharing-open');
}
function updateSharePreview() {
  if(shareSnapshot)document.querySelector('#share-preview').value=QTShare.text(shareSnapshot,document.querySelector('#share-application').checked);
}
function setShareBusy(busy) {
  shareBusy=busy;
  document.querySelectorAll('#share-application,[data-action="send-share"],[data-action="copy-share"]').forEach(el=>el.disabled=busy);
}
async function copyShareText() {
  if(!shareSnapshot||shareBusy)return;
  const text=document.querySelector('#share-preview').value;
  setShareBusy(true);
  try {
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    document.querySelector('#share-feedback').textContent='복사했어요.';
  } catch {
    const preview=document.querySelector('#share-preview');preview.focus();preview.select();
    document.querySelector('#share-feedback').textContent='내용을 선택했어요. 직접 복사해 공유해 주세요.';
  } finally {setShareBusy(false);}
}
async function sendShare() {
  if(!shareSnapshot||shareBusy)return;
  if(typeof navigator.share!=='function'){await copyShareText();return;}
  const payload={text:document.querySelector('#share-preview').value};
  setShareBusy(true);
  try {
    await navigator.share(payload);
    document.querySelector('#share-feedback').textContent='공유 메뉴로 내용을 전달했어요.';
  } catch(error) {
    document.querySelector('#share-feedback').textContent=error.name==='AbortError'?'공유를 취소했어요.':'공유 메뉴를 열 수 없어요. 내용을 복사해 공유해 주세요.';
  } finally {setShareBusy(false);}
}
document.querySelector('#share-application').addEventListener('change',updateSharePreview);
function clearShare() {
  shareSnapshot=null;document.querySelector('#share-preview').value='';document.querySelector('#share-application').checked=false;document.body.classList.remove('sharing-open');
}
function closeShare() {document.querySelector('#share-dialog').close();clearShare();}
document.querySelector('#share-dialog').addEventListener('cancel',clearShare);
document.querySelector('#share-dialog').addEventListener('close',()=>{if(!document.querySelector('#share-dialog').open)clearShare();});
function conflictLabel(path) {
  const labels={profile:'계정',chapters:'QT',reading:'말씀 읽기',legacyEntries:'이전 묵종',observation:'관찰',interpretation:'해석',application:'적용',completed:'완료',completedSteps:'QT 진행',name:'이름',avatar:'캐릭터',theme:'기본 색',decorations:'꾸미기',owned:'구매한 아이템',equipped:'적용한 아이템',qtBookId:'QT',readingBookId:'말씀',chapterVerseCounts:'읽은 절 수',bibleVersion:'성경 번역본',dailyGoal:'목표',completionRule:'완료 조건',skipSundayQt:'일요일 QT',rules:'완료 기준',completedRules:'달성 당시 기준',sessions:'',lastRange:'말씀 범위',start:'시작 절',end:'끝 절'};
  return path.map(key=>labels[key]??(CHAPTER_BY_ID.has(key)?`${CHAPTER_BY_ID.get(key).book} ${CHAPTER_BY_ID.get(key).chapter}장`:key)).filter(Boolean).join(' · ');
}
function cloudAccountHTML() {
  const a=cloudAccount;
  if(!a?.client)return '<h2>로그인</h2><p>구글 계정으로 기록을 저장하고 다른 기기에서 이어 볼 수 있어요.</p><button type="button" class="outline-button wide" disabled>구글로 로그인</button><p class="cloud-note">로그인은 연결 설정 후 이용할 수 있어요. 현재 기록은 이 기기에 저장됩니다.</p>';
  const messages={guest:'현재 기록은 이 기기에 저장됩니다.',loading:'계정 기록을 불러오는 중이에요.',syncing:'계정에 저장하는 중이에요.',pending:'이 기기에 저장했어요. 동기화를 기다리고 있어요.',synced:'계정에 저장했어요.',error:'기기에 저장된 기록을 유지하고 있어요. 연결되면 자동으로 다시 저장합니다.','auth-error':'로그인 요청을 완료하지 못했어요. 다시 시도해 주세요.',conflict:'같은 기록이 서로 다르게 수정됐어요. 아래 내용을 비교하고 저장할 내용을 선택해 주세요.'};
  if(!a.user)return `<h2>로그인</h2><p>구글 계정으로 기록을 저장하고 다른 기기에서 이어 볼 수 있어요.</p><button type="button" class="primary wide" data-action="cloud-login">구글로 로그인</button><p class="cloud-note" role="status">${messages[a.status]||messages.guest}</p>`;
  const conflict=a.conflicts.length?`<details class="sync-conflicts" open><summary>다르게 수정된 항목 ${a.conflicts.length}개</summary>${a.conflicts.map(c=>`<section><h3>${escapeHTML(conflictLabel(c.path))}</h3><label>이 기기${a.importing?'의 기존 기록':''}<textarea readonly>${escapeHTML(typeof c.local==='string'?c.local:JSON.stringify(c.local)??'내용 없음')}</textarea></label><label>${a.importing?'계정':'다른 기기'}<textarea readonly>${escapeHTML(typeof c.remote==='string'?c.remote:JSON.stringify(c.remote)??'내용 없음')}</textarea></label></section>`).join('')}<div class="sync-actions"><button type="button" class="outline-button" data-action="cloud-local">이 기기 내용 사용</button><button type="button" class="outline-button" data-action="cloud-remote">${a.importing?'계정':'다른 기기'} 내용 사용</button></div></details>`:'';
  return `<h2>로그인한 계정</h2><p class="cloud-identity">${escapeHTML(a.user.email||'구글 계정')}</p><p class="cloud-status" role="status">${messages[a.status]||messages.pending}</p>${conflict}<div class="sync-actions"><button type="button" class="text-button" data-action="cloud-logout">로그아웃</button></div>`;
}
function updateCloudAccountUI() {
  const section=document.querySelector('#cloud-account');if(section)section.innerHTML=cloudAccountHTML();
}
document.addEventListener('quolingo:install-state',()=>{
  const section=document.querySelector('#install-app');if(section)section.innerHTML=QuolingoInstall.html();
});
function loadAccountRecords() {
  shopPreview=null;
  data=load(KEY);legacy=load(LEGACY_KEY);readingData=load(READING_KEY);profile=normalizedProfile(load(PROFILE_KEY));migrateQTEntries();
}
async function startCloudAccount() {
  const config=QuolingoCloud.config(window.QUOLINGO_SUPABASE);
  const client=config&&window.supabase?window.supabase.createClient(config.url,config.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
  let first=true;
  cloudAccount=new QuolingoCloud.Account({client,store:accountStore,
    onScope:()=>{
      if(document.querySelector('#share-dialog').open)closeShare();
      loadAccountRecords();lastRoute=null;
      const restored=first?history.state?.quolingo:null;first=false;
      const target=restoreRoute(restored)?restored.page:'home';
      if(target==='home'){selected=qtChapters()[0].id;selectedDate=today;stage=0;rangeStart=1;rangeEnd=BibleReading.count(chapter(),profile.bibleVersion);}
      render(target,'replace');document.body.classList.remove('cloud-booting');document.querySelector('#cloud-boot').hidden=true;
    },
    onData:()=>{
      const focused=document.activeElement?.id,position=focused==='reflection'?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null,top=scrollY;
      loadAccountRecords();render(page,'replace');
      const input=focused&&document.getElementById(focused);if(input){input.focus({preventScroll:true});if(position)input.setSelectionRange(...position);}
      window.scrollTo({top,behavior:'instant'});
    },onStatus:updateCloudAccountUI});
  if(client){document.body.classList.add('cloud-booting');document.querySelector('#cloud-boot').hidden=false;}
  await cloudAccount.init();
  if(client){
    window.addEventListener('online',()=>{void cloudAccount.sync();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void cloudAccount.sync();});
    setInterval(()=>{if(!document.hidden&&cloudAccount.status!=='conflict')void cloudAccount.sync();},30000);
  }
}
function diamondBalance() {return QuolingoDecor.balance(allTimeCount(),profile.decorations);}
let shopCategory='background',shopCharacter='ko',shopPreview=null;
function shopSlot() {return shopCategory==='accessory'?shopCharacter:shopCategory;}
function accessoryArt(id) {
  if(id==='ribbon')return '<path d="M34 26C8 3 1 13 7 40c8 13 19-1 27-8 9 7 20 21 28 8 6-27-1-37-27-14" fill="#eea4b3" stroke="#865568" stroke-width="4" stroke-linejoin="round"/><ellipse cx="35" cy="28" rx="9" ry="11" fill="#fbc6d0" stroke="#865568" stroke-width="3"/>';
  if(id==='flower')return '<g fill="#f7b2c4" stroke="#a3657f" stroke-width="2.5"><ellipse cx="35" cy="16" rx="11" ry="14"/><ellipse cx="52" cy="29" rx="14" ry="11"/><ellipse cx="45" cy="48" rx="11" ry="14"/><ellipse cx="23" cy="48" rx="11" ry="14"/><ellipse cx="16" cy="28" rx="14" ry="11"/></g><circle cx="35" cy="32" r="11" fill="#ffe196" stroke="#ba954e" stroke-width="3"/>';
  if(id==='sunglasses')return '<path d="M0 13h8m42 7q10-8 20 0m42-7h8" stroke="#594638" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="6" y="8" width="44" height="30" rx="11" fill="#35323d" stroke="#594638" stroke-width="5"/><rect x="70" y="8" width="44" height="30" rx="11" fill="#35323d" stroke="#594638" stroke-width="5"/><path d="m17 17 10-3m54 3 10-3" stroke="#c4e2e8" stroke-width="4" stroke-linecap="round"/>';
  return '';
}
function characterAccessory(character,id) {
  if(!id)return '';
  const positions={muni:{ribbon:[189,222],flower:[250,33],sunglasses:[147,136,1.3]},ko:{ribbon:[91,177],flower:[157,38],sunglasses:[61,95,1]},tas:{ribbon:[151,124],flower:[232,15],sunglasses:[112,64,1.15]}};
  const point=positions[character]?.[id];
  return point?`<g class="character-accessory" data-accessory="${id}" transform="translate(${point[0]} ${point[1]}) scale(${point[2]||1})">${accessoryArt(id)}</g>`:'';
}
function landscapeArt(id) {
  const art={
    meadow:'<path d="M0 176Q100 90 215 166T600 145V300H0Z" fill="#9cbd8b"/><path d="M0 219Q170 132 330 210T600 188V300H0Z" fill="#679875"/><g fill="#e7f4e1"><ellipse cx="100" cy="56" rx="36" ry="11"/><ellipse cx="459" cy="76" rx="44" ry="12"/></g><g stroke="#4c775a" stroke-width="5"><path d="M56 202v-77m479 84v-99"/></g><g fill="#bad09a"><circle cx="56" cy="115" r="35"/><circle cx="535" cy="107" r="42"/></g><g fill="#ffe3b1"><circle cx="92" cy="242" r="5"/><circle cx="495" cy="230" r="5"/><circle cx="525" cy="256" r="4"/></g><g fill="#f6c4d0"><circle cx="80" cy="250" r="5"/><circle cx="510" cy="240" r="5"/><circle cx="110" cy="261" r="4"/></g>',
    sunset:'<circle cx="440" cy="90" r="42" fill="#ffdf9b"/><path d="M0 190Q120 90 270 174T600 157V300H0Z" fill="#c38f98"/><path d="M0 237Q160 142 340 218T600 193V300H0Z" fill="#8c788c"/><path d="M48 74h68m-48 10h26m402 57h55" stroke="#ffdfcf" stroke-width="7" stroke-linecap="round"/><g fill="#e4bdad"><path d="M48 268q-8-35 0-48 8 13 0 48m19-4q-8-25 0-34 8 9 0 34m477 5q-8-35 0-48 8 13 0 48"/></g>',
    starlight:'<path d="M470 38a35 35 0 1 0 36 48 35 35 0 0 1-36-48" fill="#ffe6b2"/><g fill="#fbeacb"><circle cx="85" cy="58" r="3"/><circle cx="175" cy="96" r="2"/><circle cx="280" cy="42" r="3"/><circle cx="389" cy="90" r="2"/><circle cx="553" cy="140" r="2"/><circle cx="56" cy="133" r="2"/></g><g stroke="#ead4fa" stroke-width="3" stroke-linecap="round"><path d="M150 33v13m-6-6h12m196 79v15m-7-7h14m164-13v11m-5-5h10"/></g><path d="M0 220Q120 126 260 210T600 179V300H0Z" fill="#555779"/><path d="M0 251Q170 180 342 247T600 229V300H0Z" fill="#3c4463"/>'
  };
  return art[id]?`<svg class="landscape-art" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art[id]}</svg>`:'';
}
function decoratedScene(decorations=profile.decorations) {
  const background=decorations.equipped.background;
  return `<div class="decor-scene scene-${background||'default'}">${landscapeArt(background)}<div class="scene-ground"></div>${friendsArt('꾸민 공간에서 인사하는 뮤니, 코, 타스',null,decorations)}</div>`;
}
function shopItemPreview(item) {
  if(item.category==='background')return `<div class="item-preview scene-${item.id}">${landscapeArt(item.id)}<span class="preview-house" aria-hidden="true">⌂</span></div>`;
  if(item.category==='accessory')return `<div class="item-preview accessory-preview">${friendsArt(AVATARS[shopCharacter].name+' 소품 미리보기',shopCharacter,QuolingoDecor.preview(profile.decorations,shopCharacter,item.id))}</div>`;
  return `<div class="item-preview frame-preview">${avatarFace(profile.avatar,QuolingoDecor.preview(profile.decorations,'frame',item.id))}</div>`;
}
function customize() {
  const state=profile.decorations,slot=shopSlot(),balance=diamondBalance(),categories={background:'배경',accessory:'캐릭터 소품',frame:'프로필 테두리'};
  const preview=shopPreview===null?state:QuolingoDecor.preview(state,slot,shopPreview);
  const item=QuolingoDecor.items.find(item=>item.id===shopPreview);
  const current=shopPreview===null?'지금 적용한 모습':`${item?.name||'기본 모습'} 미리보기`;
  const baseName=shopCategory==='background'?'기본 배경':shopCategory==='accessory'?'소품 없이':'기본 테두리';
  const applied=state.equipped[slot];
  const outstanding=Math.max(0,QuolingoDecor.spent(state)-allTimeCount());
  content.innerHTML=`<div class="shop-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h1>꾸미기</h1></div><div class="shop-wallet" aria-label="사용 가능한 다이아 ${balance}개"><span aria-hidden="true">💎</span><strong>${balance.toLocaleString('ko-KR')}</strong><small>사용 가능</small></div></div><p class="shop-intro">말씀 1절 = 다이아 1개 · 구매한 아이템은 계속 사용할 수 있어요.</p>${outstanding?`<p class="shop-balance-note">읽기 기록 변경으로 차감할 다이아 ${outstanding}개가 남아 있어요. 새로 모은 다이아에서 먼저 차감돼요.</p>`:''}<section class="shop-stage" tabindex="-1" aria-label="꾸미기 미리보기">${decoratedScene(preview)}<div class="shop-stage-caption"><span>${current}</span>${shopPreview!==null?'<button class="text-button" data-action="shop-reset-preview">미리보기 닫기</button>':''}</div>${shopCategory==='frame'?`<div class="shop-profile-preview">${avatarFace(profile.avatar,preview)}<span>${escapeHTML(profile.name||'나의 프로필')}</span></div>`:''}</section><div class="shop-tabs" role="group" aria-label="아이템 종류">${Object.entries(categories).map(([id,name])=>`<button data-action="shop-category" data-category="${id}" aria-pressed="${shopCategory===id}">${name}</button>`).join('')}</div>${shopCategory==='accessory'?`<div class="shop-characters" role="group" aria-label="소품을 착용할 캐릭터">${Object.entries(AVATARS).map(([id,avatar])=>`<button data-action="shop-character" data-character="${id}" aria-pressed="${shopCharacter===id}">${avatarFace(id)}<span>${avatar.name}</span></button>`).join('')}</div><p class="shop-target">${AVATARS[shopCharacter].name}에게 적용 · 선택한 캐릭터의 소품을 구매하고 적용해요.</p>`:''}<div class="shop-grid"><article class="shop-item shop-default"><div class="item-preview base-preview" aria-hidden="true">${shopCategory==='frame'?avatarFace(profile.avatar,QuolingoDecor.preview(state,'frame','')):shopCategory==='accessory'?friendsArt('기본 모습',shopCharacter,QuolingoDecor.preview(state,slot,'')):'<span>⌂</span>'}</div><div class="item-info"><h2>${baseName}</h2><p>기본 제공</p></div><div class="shop-item-actions"><button class="text-button" data-action="shop-preview" data-item="">미리보기</button><button id="shop-default" class="outline-button" data-action="shop-equip" data-item="" ${!applied?'disabled':''}>${!applied?'적용 중':'적용하기'}</button></div></article>${QuolingoDecor.items.filter(item=>item.category===shopCategory).map(item=>{
    const owned=QuolingoDecor.owns(state,item.id,slot),equipped=applied===item.id,affordable=balance>=item.price;
    return `<article class="shop-item ${equipped?'item-equipped':''}">${shopItemPreview(item)}<div class="item-info"><h2>${item.name}</h2><p>${owned?'내 아이템':`💎 ${item.price}`}</p></div><div class="shop-item-actions"><button class="text-button" data-action="shop-preview" data-item="${item.id}">미리보기</button><button id="shop-${item.id}" class="${owned?'outline-button':'primary'}" data-action="${owned?'shop-equip':'shop-buy'}" data-item="${item.id}" ${equipped||!owned&&!affordable?'disabled':''}>${equipped?'적용 중':owned?'적용하기':affordable?'구매하기':`💎 ${item.price-balance} 부족`}</button></div></article>`;
  }).join('')}</div>`;
}
function refreshShopFocus(selector,showPreview=false) {
  render('customize','replace');
  const element=document.querySelector(selector);element?.focus({preventScroll:true});
  if(showPreview)element?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function saveDecorations(decorations,message,id='') {
  const next={...profile,decorations};
  try {accountStore.setItem(PROFILE_KEY,JSON.stringify(next));}
  catch {toast('아이템을 저장하지 못했어요. 다시 시도해 주세요.');return false;}
  profile=next;shopPreview=null;render('customize','replace');
  document.getElementById('shop-'+(id||'default'))?.focus({preventScroll:true});toast(message);return true;
}
function buyShopItem(id) {
  const item=QuolingoDecor.items.find(item=>item.id===id),slot=shopSlot();
  if(!item||item.category!==shopCategory)return;
  const result=QuolingoDecor.purchase(profile.decorations,id,allTimeCount(),slot);
  if(!result.ok){toast(result.reason==='owned'?'이미 구매한 아이템이에요.':'다이아가 부족해요.');return;}
  const owner=accountStore.owner,target=item.category==='accessory'?AVATARS[slot].name+'의 ':'';
  if(!window.confirm(`${target}${item.name}을(를) 다이아 ${item.price}개로 구매하고 적용할까요?\n구매 후 잔액: 💎 ${diamondBalance()-item.price}`))return;
  if(owner!==accountStore.owner)return;
  // Validate again against current records before writing ownership and equipment together.
  const latest=QuolingoDecor.purchase(profile.decorations,id,allTimeCount(),slot);
  if(!latest.ok){toast('잔액이 변경됐어요. 다시 확인해 주세요.');return;}
  saveDecorations(latest.value,`${item.name} 구매 완료!`,id);
}
function equipShopItem(id) {
  const value=QuolingoDecor.equip(profile.decorations,shopSlot(),id);
  if(value)saveDecorations(value,'꾸미기를 적용했어요.',id);
}

function account() {
  content.innerHTML=`<h1>계정</h1><section id="cloud-account" class="card cloud-account" aria-label="로그인과 동기화">${cloudAccountHTML()}</section><section class="profile-summary"><span class="profile-avatar" aria-hidden="true">${avatarFace(profile.avatar)}</span><div><h2>${escapeHTML(profile.name||'나의 프로필')}</h2><p>${cloudAccount?.user?'계정에 저장되는 프로필':'이 브라우저에 저장되는 프로필'}</p></div></section><form id="account-form" class="account-form"><label for="profile-name">이름</label><input id="profile-name" name="name" type="text" maxlength="20" required autocomplete="nickname" value="${escapeHTML(profile.name)}"><label for="bible-version">성경 번역본</label><select id="bible-version" name="bibleVersion">${Object.entries(BIBLE_VERSIONS).map(([id,name])=>`<option value="${id}" ${profile.bibleVersion===id?'selected':''}>${name}</option>`).join('')}</select><label for="qt-book">QT</label><select id="qt-book" name="qtBook">${bookOptions(profile.qtBookId)}</select><label for="reading-book">말씀</label><select id="reading-book" name="readingBook">${bookOptions(profile.readingBookId)}</select><label for="daily-goal">매일 말씀 읽기 목표 (장)</label><input id="daily-goal" name="dailyGoal" type="number" min="1" max="1189" step="1" required value="${profile.dailyGoal}"><label for="completion-rule">완료 조건</label><select id="completion-rule" name="completionRule">${[['both','QT와 말씀 목표 모두'],['qt','QT만'],['reading','말씀 목표만']].map(([value,label])=>`<option value="${value}" ${profile.completionRule===value?'selected':''}>${label}</option>`).join('')}</select><label class="toggle-setting" for="skip-sunday-qt"><span>일요일 QT 끄기</span><input id="skip-sunday-qt" name="skipSundayQt" type="checkbox" ${profile.skipSundayQt?'checked':''}></label><fieldset><legend>기본 색</legend><div class="theme-options">${Object.entries(THEMES).map(([key,value])=>`<label class="theme-option"><input type="radio" name="theme" value="${key}" ${profile.theme===key?'checked':''}><span><i style="--swatch:${value.color}" aria-hidden="true"></i>${value.name}</span></label>`).join('')}</div></fieldset><fieldset><legend>프로필 캐릭터</legend><div class="avatar-options">${Object.entries(AVATARS).map(([key,value])=>`<label class="avatar-option"><input type="radio" name="avatar" value="${key}" ${profile.avatar===key?'checked':''}><span>${avatarFace(key)}${value.name}</span></label>`).join('')}</div></fieldset><button type="submit" class="primary wide">저장</button></form><section id="install-app" class="card install-app" aria-label="앱 설치와 바로가기">${QuolingoInstall.html()}</section><a class="source-note" href="THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener">성경 본문 출처 · 번역본 안내</a>`;
}
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(e.target.name==='theme') {
    const theme=e.target.value;if(!Object.hasOwn(THEMES,theme))return;
    applyTheme(theme);
    return;
  }
  if(id==='word-chapter'){selected=e.target.value;history.replaceState({quolingo:routeState(),scroll:scrollY},'');lastRoute=routeState();return;}
  if(!['chapter-select','start-verse','end-verse'].includes(id))return;
  if(id==='chapter-select'){
    selected=e.target.value;const last=record().lastRange;
    rangeStart=validRange(chapter(),last?.start,last?.end,profile.bibleVersion)?last.start:1;
    rangeEnd=validRange(chapter(),last?.start,last?.end,profile.bibleVersion)?last.end:BibleReading.count(chapter(),profile.bibleVersion);
  }
  if(id==='start-verse'){rangeStart=Number(e.target.value);rangeEnd=Math.max(rangeStart,rangeEnd);}
  if(id==='end-verse')rangeEnd=Number(e.target.value);
  render('selection','replace');document.getElementById(id).focus();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='account-form'){
    e.preventDefault();const values=new FormData(e.target),name=String(values.get('name')||'').trim(),avatar=String(values.get('avatar')||''),theme=String(values.get('theme')||''),qtBookId=String(values.get('qtBook')||''),readingBookId=String(values.get('readingBook')||''),bibleVersion=String(values.get('bibleVersion')||'');
    if(!name||name.length>20||!Object.hasOwn(AVATARS,avatar)||!Object.hasOwn(THEMES,theme)||!validBookId(qtBookId)||!validBookId(readingBookId)||!Object.hasOwn(BIBLE_VERSIONS,bibleVersion))return;
    const nextProfile={...profile,name,avatar,theme,qtBookId,readingBookId,bibleVersion,...DailyProgress.settings({dailyGoal:Number(values.get('dailyGoal')),completionRule:values.get('completionRule'),skipSundayQt:values.get('skipSundayQt')==='on'})};
    try{commitProfile(nextProfile);render('account');toast('프로필을 저장했어요.');}
    catch{toast('프로필을 저장할 수 없어요. 브라우저 저장 공간을 확인해 주세요.');}
    return;
  }
  if(e.target.id==='word-selection'){e.preventDefault();render('reader');window.scrollTo({top:0,behavior:'instant'});return;}
  if(e.target.id!=='passage-selection')return;
  e.preventDefault();if(!validRange(chapter(),rangeStart,rangeEnd))return;
  stage=0;render('editor');window.scrollTo({top:0,behavior:'instant'});
});
document.addEventListener('input',e=>{if(e.target.id!=='reflection')return;updateRecord({[fields[stage-1]]:e.target.value});document.querySelector('#next').disabled=!e.target.value.trim();});
function releaseHeldButton() {
  heldButton?.classList.remove('is-held');heldButton=null;
}
document.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0)return;
  const button=e.target.closest('.day-node,.primary,.mode-tabs button');
  if(!button||button.disabled)return;
  releaseHeldButton();heldButton=button;button.classList.add('is-held');
},{passive:true});
for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,releaseHeldButton,true);
window.addEventListener('blur',releaseHeldButton);
document.addEventListener('click',e=>{
 const logo=e.target.closest('a.logo,a.mobile-logo');
 if(logo){e.preventDefault();render('home');window.scrollTo({top:0,behavior:'instant'});return;}
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.action==='cloud-login')void cloudAccount.login(location.origin+location.pathname);
 if(b.dataset.action==='cloud-logout')void cloudAccount.logout();
 if(b.dataset.action==='cloud-local')void cloudAccount.resolve('local');
 if(b.dataset.action==='cloud-remote')void cloudAccount.resolve('remote');
 if(b.dataset.action==='install-app')void QuolingoInstall.request();
 if(b.dataset.action==='bible-retry')render(page,'replace');
 if(b.dataset.action==='shop-category'&&['background','accessory','frame'].includes(b.dataset.category)){shopCategory=b.dataset.category;shopPreview=null;refreshShopFocus(`[data-action=shop-category][data-category=${shopCategory}]`);}
 if(b.dataset.action==='shop-character'&&Object.hasOwn(AVATARS,b.dataset.character)){shopCharacter=b.dataset.character;shopPreview=null;refreshShopFocus(`[data-action=shop-character][data-character=${shopCharacter}]`);}
 if(b.dataset.action==='shop-preview'){shopPreview=b.dataset.item;refreshShopFocus('.shop-stage',true);}
 if(b.dataset.action==='shop-reset-preview'){shopPreview=null;refreshShopFocus('.shop-stage');}
 if(b.dataset.action==='shop-buy')buyShopItem(b.dataset.item);
 if(b.dataset.action==='shop-equip')equipShopItem(b.dataset.item);
 if(b.dataset.page){render(b.dataset.page);window.scrollTo({top:0,behavior:'instant'});}
 if(b.dataset.chapter)openChapter(b.dataset.chapter,Number(b.dataset.start),Number(b.dataset.end),b.dataset.date||today);
 if(b.dataset.action==='open-share')openShare();
 if(b.dataset.action==='share-entry')openShare({id:b.dataset.shareChapter,date:b.dataset.date,start:Number(b.dataset.start),end:Number(b.dataset.end)});
 if(b.dataset.action==='delete-entry')deleteJournalEntry({id:b.dataset.deleteChapter,date:b.dataset.date,start:Number(b.dataset.start),end:Number(b.dataset.end),old:b.dataset.legacy==='true'});
 if(b.dataset.action==='close-share')closeShare();
 if(b.dataset.action==='send-share')void sendShare();
 if(b.dataset.action==='copy-share')void copyShareText();
 if(b.dataset.action==='mode'){mode=b.dataset.mode==='reading'?'reading':'qt';render('home');}
 if(b.dataset.action==='word-reselect')render('wordSelection');
 if(b.dataset.action==='open-reading'&&ACTIVE_CHAPTER_IDS.has(b.dataset.readingId)&&validDay(b.dataset.date)&&b.dataset.date<=today){selected=b.dataset.readingId;selectedDate=b.dataset.date;render('reader');window.scrollTo({top:0,behavior:'instant'});}
 if(b.dataset.action==='read-chapter')setChapterRead(selected,selectedDate,!readChapters(selectedDate).includes(selected));
 if(b.dataset.action==='activity-date'&&validDay(b.dataset.date)&&b.dataset.date<=today){activityDate=b.dataset.date;render('activity');document.querySelector(`.calendar-day[data-date="${activityDate}"]`).focus({preventScroll:true});}
 if(b.dataset.action==='activity-month'){
   const date=new Date(activityMonth+'-01T12:00:00+09:00');date.setUTCMonth(date.getUTCMonth()+Number(b.dataset.shift));
   const month=dayKey(date).slice(0,7);
   if(month<=today.slice(0,7)){activityMonth=month;activityDate=month===today.slice(0,7)?today:month+'-01';render('activity');document.querySelector(`[data-action="activity-month"][data-shift="${b.dataset.shift}"]`).focus({preventScroll:true});}
 }
 if(['next-chapter','previous-chapter'].includes(b.dataset.action)&&selectionChapters().some(c=>c.id===b.dataset.next)){selected=b.dataset.next;render('reader');window.scrollTo({top:0,behavior:'instant'});}
 if(b.dataset.action==='open-day'){
   if(openingDayTimer!==null)return;
   if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)openDay(b.dataset.date);
   else{b.classList.add('is-opening');openingDayTimer=setTimeout(()=>{openingDayTimer=null;if(b.isConnected)openDay(b.dataset.date);},240);}
 }
 if(b.dataset.action==='reselect')render('selection');
 if(b.dataset.action==='previous'){if(stage>0){stage--;render('editor');}else render('selection');window.scrollTo({top:0,behavior:'instant'});}
 if(b.dataset.action==='next'){
  if(stage===0)updateRecord({read:selectedVerses(),completedSteps:Math.max(DailyProgress.qtSteps(sessionRecord()),1)});
  else if(!sessionRecord()[fields[stage-1]]?.trim())return;
  else if(stage<3)updateRecord({completedSteps:Math.max(DailyProgress.qtSteps(sessionRecord()),stage+1)});
  if(stage<3){stage++;render('editor');}
  else if(fields.every(f=>sessionRecord()[f]?.trim())&&sessionRecord().read?.length){const ok=updateRecord({completed:true,completedSteps:4});render('success');if(!ok)toast('기기에 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');}
  else toast('읽은 절과 관찰·해석·적용을 확인해 주세요.');
  window.scrollTo({top:0,behavior:'instant'});
 }
});
function refreshDay(){if(today!==dayKey()){rememberDailyRules(today);today=dayKey();selectedDate=today;activityMonth=today.slice(0,7);activityDate=today;stage=0;render('home');toast('새 하루가 시작됐어요. 이전 기록은 나의 묵종에 있어요.');}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});setInterval(refreshDay,30000);
if(savedProfile.completionRule==='either') {
  // Remove the retired choice from the current profile, keeping past daily rules intact.
  try { commitProfile(profile,{...profile,...DailyProgress.settings(savedProfile)}); }
  catch { toast('설정을 저장할 수 없어요. 브라우저 저장 공간을 확인해 주세요.'); }
}
if(!validBookId(savedProfile.qtBookId)||!validBookId(savedProfile.readingBookId)){
  try { accountStore.setItem(PROFILE_KEY,JSON.stringify(profile)); } catch { /* Keep preferences in memory when storage is unavailable. */ }
}
document.querySelector('.sidebar-friend').innerHTML=friendsArt('손을 흔들며 인사하는 뮤니, 코, 타스');
void startCloudAccount();
