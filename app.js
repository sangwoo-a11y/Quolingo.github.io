const KEY = 'quolingo-chapters-v2';
const LEGACY_KEY = 'quolingo-journal-v1';
const fields = ['observation', 'interpretation', 'application'];
const parts = ['관찰', '해석', '적용'];
const prompts = ['본문에서 어떤 장면과 단어가 눈에 들어오나요?', '이 말씀은 하나님에 대해 무엇을 알려 주나요?', '오늘 내 삶에서 실천할 작은 한 가지를 적어 보세요.'];
const content = document.querySelector('#content');
let data = {}, legacy = {}, storageOK = true, page = 'home', stage = 0, selected = CHAPTERS[0].id;
function load(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { storageOK = false; return {}; }
}
data = load(KEY); legacy = load(LEGACY_KEY);
function dayKey(date = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function shiftDay(key, n) { const date = new Date(key + 'T12:00:00+09:00'); date.setUTCDate(date.getUTCDate() + n); return dayKey(date); }
let today = dayKey();
function chapter() { return CHAPTERS.find(c => c.id === selected) || CHAPTERS[0]; }
function record(id = selected, date = today) { return data[date]?.[id] || {}; }
function readVerses(id = selected, date = today) {
  const c = CHAPTERS.find(c => c.id === id);
  return [...new Set(Array.isArray(record(id,date).read) ? record(id,date).read : [])].filter(n => Number.isInteger(n) && n >= 1 && n <= c.verses.length).sort((a,b) => a-b);
}
function updateRecord(changes) {
  data[today] = {...data[today], [selected]: {...record(), ...changes}};
  try { localStorage.setItem(KEY, JSON.stringify(data)); storageOK = true; return true; }
  catch { storageOK = false; toast('브라우저 저장 실패 · 나의 묵상에서 파일로 백업해 주세요.'); return false; }
}
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
function completedDay(date) { return Boolean(legacy[date]?.completed || CHAPTERS.some(c => record(c.id,date).completed)); }
function streak() { let n=0, key=completedDay(today)?today:shiftDay(today,-1); while(completedDay(key)){n++;key=shiftDay(key,-1);} return n; }
function todayCount() { return CHAPTERS.reduce((sum,c)=>sum+readVerses(c.id).length,0); }
function toast(message) { const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500); }
function updateStats() {
  const count=todayCount(); document.querySelector('#streak').textContent=streak(); document.querySelector('#total').textContent=count;
  document.querySelector('#goal-bar').style.width=Math.min(100,count/10*100)+'%';
  document.querySelector('#goal-text').textContent=`${count} / 10절`;
  document.querySelector('#goal-hint').textContent=count>=10?'오늘의 읽기 목표 달성! 참 잘했어요.':'한 절을 읽을 때마다 한 걸음 더!';
  const weekday=new Date(today+'T12:00:00+09:00').getUTCDay();const monday=shiftDay(today,-((weekday+6)%7));
  document.querySelector('#week').innerHTML=['월','화','수','목','금','토','일'].map((label,i)=>{const date=shiftDay(monday,i);return `<div class="day ${date===today?'today':''} ${completedDay(date)?'checked':''}">${label}<i>${completedDay(date)?'✓':'·'}</i></div>`;}).join('');
}
function render(target=page) {
  page=target; document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page || page==='editor'&&b.dataset.page==='home'));
  ({home,editor,journal,friends,activity,success,guide}[page] || home)();updateStats();
}
function star() { return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 2 4.3 8.7 9.6 1.4-6.9 6.7 1.6 9.5L16 23.8l-8.6 4.5L9 18.8l-6.9-6.7 9.6-1.4Z" fill="currentColor"/></svg>'; }
function home() {
  const next=CHAPTERS.find(c=>readVerses(c.id).length<c.verses.length)?.id || CHAPTERS[0].id;
  content.innerHTML=`<section class="unit"><div><small>말씀 여행 · 시편</small><h1>한 장씩, 마음에 새기는 말씀</h1></div><button class="guide-button" data-page="guide">▤ <span>읽기 안내</span></button></section><div class="journey-intro"><span>시편과 함께 걷기</span><small>한 장 = 하나의 버튼 · 오늘 읽은 절만큼 채워져요</small></div><div class="chapter-path">${CHAPTERS.map((c,i)=>{const count=readVerses(c.id).length,percent=count/c.verses.length*100,active=c.id===next;return `<div class="chapter-stop stop-${i} ${active?'is-current':''}">${active?'<span class="start-bubble">'+(count?'이어 읽기':'시작하기')+'</span>':''}<button class="chapter-node ${count===c.verses.length?'complete':''} ${active?'current':''}" data-chapter="${c.id}" aria-label="${c.book} ${c.chapter}장, ${c.verses.length}절 중 ${count}절 읽음" style="--fill:${percent}%"><span class="node-core">${count===c.verses.length?'✓':star()}</span></button><div class="chapter-caption"><strong>${c.book} ${c.chapter}장</strong><span>${count} / ${c.verses.length}절</span></div></div>`;}).join('')}<div class="path-friends"><div class="speech">한 절씩, 천천히 읽어도 좋아!</div><img src="assets/friends.png" alt="말씀 여행을 응원하는 뮤니, 코, 타스"></div><div class="path-sprout" aria-hidden="true">🌱</div></div><div class="section-divider"><span>말씀을 읽고, 삶으로 걸어요</span></div><p class="path-note">시편 6개 장 · 개역한글<br>버튼을 누르고 읽은 절을 체크해 보세요.</p>`;
}
function openChapter(id) { selected=id;stage=0;render('editor'); window.scrollTo({top:0,behavior:'instant'}); }
function editor() {
  const c=chapter(),r=record(),read=readVerses();
  content.innerHTML=`<div class="editor-head"><button class="back" data-page="home" aria-label="말씀 경로로 돌아가기">←</button><span>${c.book} ${c.chapter}장 · ${c.title}</span><span>${stage+1} / 4</span></div><div class="editor-progress">${[0,1,2,3].map(i=>`<span class="${i<=stage?'filled':''}"></span>`).join('')}</div>${stage===0?`<div class="reading-title"><div><div class="eyebrow">TODAY’S WORD</div><h1>${c.book} ${c.chapter}장</h1><p>${c.title} · 개역한글</p></div><span class="reading-count" id="reading-count">${read.length} / ${c.verses.length}절</span></div><p class="prompt">읽은 절을 눌러 체크하세요. 읽은 만큼 장의 게이지가 채워져요.</p><div class="reading-progress"><i id="reading-bar" style="width:${read.length/c.verses.length*100}%"></i></div><div class="verses">${c.verses.map((v,i)=>`<label class="verse-row ${read.includes(i+1)?'is-read':''}"><input type="checkbox" data-verse="${i+1}" ${read.includes(i+1)?'checked':''}><span class="verse-number">${i+1}</span><span>${v}</span><span class="verse-check" aria-hidden="true">✓</span></label>`).join('')}</div><p class="save-note" id="save-status">${storageOK?'체크한 절은 자동 저장돼요.':'저장 실패 · 기록을 파일로 백업해 주세요.'}</p><button class="primary wide" id="next" data-action="next" ${read.length?'':'disabled'}>읽은 말씀으로 묵상하기 →</button>`:`<div class="eyebrow">QT JOURNAL · ${c.book} ${c.chapter}장</div><h1>${parts[stage-1]}하기</h1><p class="prompt">${prompts[stage-1]}</p><details class="reading-excerpt"><summary>오늘 읽은 ${read.length}절 다시 보기</summary>${read.map(n=>`<p><sup>${n}</sup> ${c.verses[n-1]}</p>`).join('')}</details><label for="reflection" class="sr-only">나의 ${parts[stage-1]}</label><textarea id="reflection" placeholder="마음에 떠오르는 생각을 적어 주세요…">${escapeHTML(r[fields[stage-1]])}</textarea><p class="save-note" id="save-status">${storageOK?'입력한 내용은 자동 저장돼요.':'브라우저 저장을 사용할 수 없어요. 기록을 백업해 주세요.'}</p><div class="actions"><button class="text-button" data-action="previous">← 이전</button><button class="primary" id="next" data-action="next" ${r[fields[stage-1]]?.trim()?'':'disabled'}>${stage===3?'묵상 완료하기 ✓':'다음으로 →'}</button></div>`}`;
}
function journalCard(date,c,r,old=false) {return `<article class="entry"><small>${date} · ${r.completed?'묵상 완료 ✓':'작성 중'}${old?' · 이전 버전 기록':''}</small><h2>${old?'이전 말씀 묵상':c.book+' '+c.chapter+'장'}</h2>${!old?`<p class="read-label">읽은 절: ${readVerses(c.id,date).join(', ')||'없음'}</p>`:''}${fields.map((f,i)=>`<h3>${parts[i]}</h3><p>${escapeHTML(r[f]||'아직 작성하지 않았어요.')}</p>`).join('')}${!old&&date===today?`<button class="text-button" data-chapter="${c.id}">기록 이어 쓰기 →</button>`:''}</article>`;}
function journal() {
 const dates=[...new Set([...Object.keys(data),...Object.keys(legacy)])].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
 const cards=dates.map(date=>CHAPTERS.filter(c=>readVerses(c.id,date).length||fields.some(f=>record(c.id,date)[f])).map(c=>journalCard(date,c,record(c.id,date))).join('')+(legacy[date]&&fields.some(f=>legacy[date][f])?journalCard(date,null,legacy[date],true):'')).join('');
 content.innerHTML=`<div class="eyebrow">MY QUIET TIME</div><h1>나의 묵상</h1><p class="intro">한 장의 말씀, 나만의 이야기.</p><button class="outline-button" data-action="export">↓ 전체 기록 백업</button>${cards||'<div class="empty">📖<p>아직 기록이 없어요.<br>말씀 여행에서 첫 장을 열어 보세요.</p><button class="primary" data-page="home">말씀 읽으러 가기</button></div>'}`;
}
function friends() {content.innerHTML=`<div class="eyebrow">CCC FRIENDS</div><h1>우리, 함께 자라요.</h1><p class="intro">당신의 말씀 여행을 응원하는 세 친구</p><div class="friends-portrait"><img src="assets/friends.png" alt="왼쪽부터 주황 여우 뮤니, 노란 병아리 코, 베이지 곰 타스"></div><div class="friend-names"><div><b>뮤니</b><span>다정한 응원</span></div><div><b>코</b><span>작은 시작의 용기</span></div><div><b>타스</b><span>든든한 동행</span></div></div><section class="card friend-quote"><h2>“오늘도 한 절, 함께 읽을까?”</h2><p>많이 읽는 날도, 한 절에 오래 머무는 날도.<br>말씀 앞에 앉은 당신을 응원해요.</p></section><button class="primary wide" data-page="home">말씀 여행으로 돌아가기</button>`;}
function activity() {const dates=[...new Set([...Object.keys(data),...Object.keys(legacy)])].filter(completedDay);content.innerHTML=`<div class="eyebrow">MY JOURNEY</div><h1>말씀과 걸어온 발자국</h1><div class="activity-stats"><section class="card"><span>🔥</span><h2>${streak()}일</h2><p>연속 묵상</p></section><section class="card"><span>💎</span><h2>${todayCount()}절</h2><p>오늘 읽은 말씀</p></section><section class="card"><span>🏅</span><h2>${dates.length}일</h2><p>전체 묵상 일수</p></section></div><h2>오늘의 장별 읽기</h2>${CHAPTERS.map(c=>`<button class="chapter-summary" data-chapter="${c.id}"><span>${c.book} ${c.chapter}장 <small>${c.title}</small></span><b>${readVerses(c.id).length} / ${c.verses.length}절 →</b></button>`).join('')}`;}
function success() {content.innerHTML=`<section class="success"><div class="eyebrow">WELL DONE!</div><div class="medal">🏅</div><h1>말씀을 마음에 심었어요!</h1><p>${chapter().book} ${chapter().chapter}장 · ${readVerses().length}절 묵상 완료<br>오늘의 작은 실천을 응원해요.</p><img src="assets/friends.png" alt="축하하는 뮤니, 코, 타스"><section class="card"><h3>🔥 ${streak()}일 연속 묵상</h3><p>읽기 ${readVerses().length} / ${chapter().verses.length}절 · ${readVerses().length===chapter().verses.length?'한 장을 모두 읽었어요!':'남은 말씀도 언제든 이어 읽을 수 있어요.'}</p></section><button class="primary wide" data-page="home">말씀 여행 계속하기</button><button class="text-button" data-page="journal">나의 묵상 보기 →</button></section>`;}
function guide() {content.innerHTML=`<div class="eyebrow">GUIDEBOOK</div><h1>한 장씩 읽는 말씀 여행</h1><section class="card guide"><h2>1. 장 버튼을 열어요</h2><p>경로의 버튼 하나는 성경 한 장이에요. 시편 1·23·100·117·121·150장, 총 6개 장을 준비했어요. 어떤 장이든 선택할 수 있어요.</p><h2>2. 읽은 절을 체크해요</h2><p>오늘 체크한 절 수 ÷ 그 장의 전체 절 수만큼 원형 게이지가 채워져요. 예를 들어 시편 1장에서 3절을 읽으면 50%예요. 다시 눌러 체크를 해제할 수 있고, 같은 절을 여러 번 눌러도 중복 계산하지 않아요.</p><h2>3. 말씀을 내 삶으로 가져와요</h2><p>관찰·해석·적용을 기록하고 묵상을 완료하면 연속 묵상에 반영돼요. 읽기 게이지는 묵상 작성량과 관계없이 읽은 절만 계산해요.</p><h2>매일 새로운 시작</h2><p>한국 시간 자정에 오늘의 게이지가 새로 시작해요. 어제의 읽기와 묵상 기록은 나의 묵상에 남아요. 기록은 이 브라우저에만 저장되므로 전체 기록 백업을 이용해 주세요.</p></section><button class="primary wide" data-page="home">알겠어요, 시작할게요</button>`;updateStats();}
document.addEventListener('change',e=>{
 const n=Number(e.target.dataset.verse);if(!n)return;
 const read=readVerses();const next=e.target.checked?[...read,n]:read.filter(v=>v!==n);
 const ok=updateRecord({read:next});e.target.closest('.verse-row').classList.toggle('is-read',e.target.checked);
 document.querySelector('#reading-count').textContent=`${next.length} / ${chapter().verses.length}절`;
 document.querySelector('#reading-bar').style.width=next.length/chapter().verses.length*100+'%';document.querySelector('#next').disabled=!next.length;
 document.querySelector('#save-status').textContent=ok?'읽은 절을 저장했어요 ✓':'저장 실패 · 나의 묵상에서 파일로 백업해 주세요.';updateStats();
});
document.addEventListener('input',e=>{if(e.target.id!=='reflection')return;const ok=updateRecord({[fields[stage-1]]:e.target.value});document.querySelector('#save-status').textContent=ok?'방금 자동 저장했어요 ✓':'저장 실패 · 나의 묵상에서 파일로 백업해 주세요.';document.querySelector('#next').disabled=!e.target.value.trim();});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.page)render(b.dataset.page);
 if(b.dataset.chapter)openChapter(b.dataset.chapter);
 if(b.dataset.action==='previous'){stage--;render('editor');}
 if(b.dataset.action==='next'){
  if(stage===0&&!readVerses().length)return;
  if(stage<3){stage++;render('editor');}
  else if(fields.every(f=>record()[f]?.trim())&&readVerses().length){const ok=updateRecord({completed:true});render('success');if(!ok)toast('기록이 메모리에만 있어요. 파일로 백업해 주세요.');}
  else toast('읽은 절과 관찰·해석·적용을 확인해 주세요.');
 }
 if(b.dataset.action==='export'){const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),chapters:data,legacyEntries:legacy},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quolingo-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('전체 기록을 파일로 백업했어요.');}
});
function refreshDay(){if(today!==dayKey()){today=dayKey();stage=0;render('home');toast('새 하루의 말씀 여행을 시작해요. 이전 기록은 나의 묵상에 있어요.');}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});setInterval(refreshDay,30000);
render();
