const KEY = 'quolingo-journal-v1';
const passages = [
  ['시편 23:1–3', '여호와는 나의 목자시니 내가 부족함이 없으리로다. 그가 나를 푸른 초장에 누이시며 쉴 만한 물가으로 인도하시는도다. 내 영혼을 소생시키시고 자기 이름을 위하여 의의 길로 인도하시는도다.'],
  ['빌립보서 4:6–7', '아무 것도 염려하지 말고 오직 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라. 그리하면 모든 지각에 뛰어난 하나님의 평강이 그리스도 예수 안에서 너희 마음과 생각을 지키시리라.'],
  ['잠언 3:5–6', '너는 마음을 다하여 여호와를 의뢰하고 네 명철을 의지하지 말라. 너는 범사에 그를 인정하라 그리하면 네 길을 지도하시리라.'],
  ['마태복음 5:14–16', '너희는 세상의 빛이라 산 위에 있는 동네가 숨기우지 못할 것이요. 사람이 등불을 켜서 말 아래 두지 아니하고 등경 위에 두나니 이러므로 집 안 모든 사람에게 비취느니라. 이같이 너희 빛을 사람 앞에 비취게 하여 저희로 너희 착한 행실을 보고 하늘에 계신 너희 아버지께 영광을 돌리게 하라.'],
  ['이사야 41:10', '두려워 말라 내가 너와 함께 함이니라 놀라지 말라 나는 네 하나님이 됨이니라 내가 너를 굳세게 하리라 참으로 너를 도와 주리라 참으로 나의 의로운 오른손으로 너를 붙들리라.'],
  ['시편 119:105', '주의 말씀은 내 발에 등이요 내 길에 빛이니이다.'],
  ['요한복음 15:5', '나는 포도나무요 너희는 가지니 저가 내 안에, 내가 저 안에 있으면 이 사람은 과실을 많이 맺나니 나를 떠나서는 너희가 아무 것도 할 수 없음이라.']
];
const parts = ['관찰', '해석', '적용'];
const prompts = ['본문에 누가 등장하나요? 반복되는 단어나 마음에 남는 구절을 적어 보세요.', '이 말씀에서 하나님은 어떤 분이신가요? 본문이 전하는 뜻을 생각해 보세요.', '오늘 내 삶에서 실천할 작은 한 가지는 무엇인가요? 구체적으로 적어 보세요.'];
const content = document.querySelector('#content');
let entries = {}, storageOK = true, stage = 0, page = 'home';
try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) entries = saved; } catch { storageOK = false; }
function dayKey(date = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function shiftDay(key, n) { const d = new Date(key + 'T12:00:00+09:00'); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); }
function passageFor(key) { return passages[Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000) % passages.length]; }
let today = dayKey();
function current() { return entries[today] || { observation:'', interpretation:'', application:'', completed:false }; }
const fields = ['observation','interpretation','application'];
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(entries)); storageOK = true; return true; } catch { storageOK = false; toast('저장 공간을 사용할 수 없어요. 기록을 파일로 보관해 주세요.'); return false; } }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3500); }
function streak() { let count = 0, key = current().completed ? today : shiftDay(today,-1); while (entries[key]?.completed) {count++; key = shiftDay(key,-1);} return count; }
function updateStats() {
  document.querySelector('#streak').textContent = streak();
  document.querySelector('#total').textContent = Object.values(entries).filter(e=>e.completed).length;
  const amount = current().completed ? 100 : fields.filter(f=>current()[f]?.trim()).length / 3 * 100;
  document.querySelector('#goal-bar').style.width = amount + '%';
  document.querySelector('#goal-text').textContent = current().completed ? '오늘의 QT 완료! 참 잘했어요 ✨' : `${fields.filter(f=>current()[f]?.trim()).length} / 3개의 묵상을 기록했어요`;
  const weekday = new Date(today+'T12:00:00+09:00').getUTCDay();
  const monday = shiftDay(today, -(weekday + 6) % 7);
  document.querySelector('#week').innerHTML = ['월','화','수','목','금','토','일'].map((label,i)=>{const key=shiftDay(monday,i);return `<div class="day ${key===today?'today':''} ${entries[key]?.completed?'checked':''}">${label}<i>${entries[key]?.completed?'✓':'·'}</i></div>`;}).join('');
}
function verse() { const p = passageFor(today); return `<section class="verse-card"><div class="eyebrow">TODAY’S WORD · 오늘의 말씀</div><blockquote>“${p[1]}”</blockquote><cite>${p[0]} · 개역한글</cite></section>`; }
function render(target = page) {
  page = target; document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  if(page==='home') home(); if(page==='editor') editor(); if(page==='journal') journal(); if(page==='friends') friends(); if(page==='success') success();
  updateStats();
}
function home() {
  const date = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date(today+'T12:00:00+09:00'));
  content.innerHTML = `<div class="eyebrow">A LITTLE FAITH, EVERY DAY</div><h1>오늘도, 말씀과 한 걸음</h1><p class="intro">${date} · 나를 위한 고요한 시간을 가져 보세요.</p><section class="hero"><span class="tag">마음이 자라는 시간</span><h2>작은 묵상 하나가<br>오늘을 바꿀 거예요.</h2><p>완벽하지 않아도 괜찮아요.<br>우리 함께 시작해 볼까요?</p><img src="assets/friends.svg" alt="당신을 응원하는 뮤니, 코, 타스"></section><div class="unit"><div><small>DAILY QT · 매일의 만나</small><h3>${current().completed?'오늘의 여정을 마쳤어요':'말씀을 읽고, 삶으로 걸어요'}</h3></div><span class="book">▤</span></div><div class="path"><div class="path-row"><button class="step ${current().completed?'done':'current'}" data-action="begin" aria-label="오늘의 말씀 읽기">${current().completed?'✓':'▤'}</button><div class="path-label"><strong>오늘의 말씀</strong>${passageFor(today)[0]}</div></div>${parts.map((p,i)=>`<div class="path-row"><button class="step ${current()[fields[i]]?.trim()?'done':''}" data-stage="${i+1}" aria-label="${p} 작성하기">${['⌕','✦','⚑'][i]}</button><div class="path-label">${p}하기 ${current()[fields[i]]?.trim()?'✓':''}</div></div>`).join('')}<img class="path-decoration" src="assets/friends.svg" alt=""></div><button class="primary wide" data-action="begin">${current().completed?'오늘의 묵상 돌아보기':'오늘의 QT '+(fields.some(f=>current()[f]?.trim())?'이어하기':'시작하기')} →</button>`;
}
function editor() {
  content.innerHTML = `<div class="editor-head"><button class="back" data-page="home" aria-label="홈으로 돌아가기">←</button><span class="eyebrow">오늘 나에게 주시는 말씀</span><span>${stage+1} / 4</span></div><div class="editor-progress">${[0,1,2,3].map(i=>`<span class="${i<=stage?'filled':''}"></span>`).join('')}</div>${stage===0?`${verse()}<p class="prompt">천천히 말씀을 읽어 보세요.<br>마음에 와닿는 한 구절을 생각하며 묵상을 시작해요.</p><button class="primary wide" data-action="next">말씀을 읽었어요 →</button>`:`<div class="eyebrow">STEP 0${stage} · QT JOURNAL</div><h1>${parts[stage-1]}하기</h1><p class="prompt">${prompts[stage-1]}</p><details><summary>오늘의 말씀 다시 읽기 · ${passageFor(today)[0]}</summary>${verse()}</details><label for="reflection" class="sr-label">나의 ${parts[stage-1]}</label><textarea id="reflection" placeholder="떠오르는 생각을 자유롭게 적어 주세요…">${escapeHTML(current()[fields[stage-1]])}</textarea><p class="save-note" id="save-status">${storageOK?'입력한 내용은 이 브라우저에 자동 저장돼요.':'브라우저 저장을 사용할 수 없어요. 기록을 파일로 보관해 주세요.'}</p><div class="actions"><button class="text-button" data-action="previous">← 이전</button><button class="primary" id="next" data-action="next" ${current()[fields[stage-1]]?.trim()?'':'disabled'}>${stage===3?'묵상 완료하기 ✓':'다음으로 →'}</button></div>`}`;
  document.querySelector('#reflection')?.addEventListener('input', e=>{ entries[today] = {...current(),[fields[stage-1]]:e.target.value}; const ok=persist(); document.querySelector('#save-status').textContent=ok?'방금 자동 저장했어요 ✓':'저장 실패 · 나의 기록에서 파일로 보관해 주세요.'; document.querySelector('#next').disabled=!e.target.value.trim(); updateStats(); });
}
function journal() {
  const keys = Object.keys(entries).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&fields.some(f=>entries[k]?.[f])).sort().reverse();
  content.innerHTML = `<div class="eyebrow">MY QUIET TIME</div><h1>나의 묵상 기록</h1><p class="intro">말씀과 함께 쌓아 온 소중한 순간들</p><button class="text-button" data-action="export">↓ 전체 기록 백업하기 (JSON)</button>${keys.length?keys.map(k=>`<article class="entry"><small>${k} · ${entries[k].completed?'QT 완료 ✓':'작성 중'}</small><h2>${passageFor(k)[0]}</h2>${fields.map((f,i)=>`<h3>${parts[i]}</h3><p>${escapeHTML(entries[k][f] || '아직 작성하지 않았어요.')}</p>`).join('')}${k===today?'<button class="text-button" data-action="begin">오늘 기록 수정하기 →</button>':''}</article>`).join(''):'<div class="empty">🌿<br>아직 기록이 없어요.<br>오늘, 첫 번째 묵상을 남겨 보세요.<br><button class="text-button" data-action="begin">QT 시작하기 →</button></div>'}`;
}
function friends() { content.innerHTML = `<div class="eyebrow">MEET YOUR FRIENDS</div><h1>함께 걸어가는 친구들</h1><p class="intro">당신의 작은 시작을 응원하는 CCC FRIENDS</p><img class="friends-big" src="assets/friends.svg" alt="왼쪽부터 여우 뮤니, 병아리 코, 곰 타스"><div class="friend-names"><div><b>뮤니</b><br><small>따뜻한 응원 한마디</small></div><div><b>코</b><br><small>작은 시작의 용기</small></div><div><b>타스</b><br><small>묵묵한 동행</small></div></div><section class="verse-card" style="margin-top:35px"><h3>“오늘도 함께해 줘서 고마워!”</h3><p class="prompt">많이 쓰는 것보다 매일 말씀 앞에 머무는 것이 소중해요.<br>우리와 함께 하루 한 걸음씩 걸어가요.</p></section><button class="primary wide" data-action="begin">친구들과 오늘의 QT 하기 →</button>`; }
function success() { content.innerHTML = `<section class="success"><div class="eyebrow">YOU DID IT!</div><div class="medal">🏅</div><h1>오늘의 묵상을 마쳤어요!</h1><p>말씀을 삶에 심은 당신, 참 잘했어요.<br>오늘의 작은 실천이 내일의 나를 자라게 할 거예요.</p><img src="assets/friends.svg" alt="축하하는 세 친구"><section class="card"><h3>🔥 ${streak()}일 연속 QT · 💎 묵상 +1</h3><p style="margin-bottom:0">내일도 이 자리에서 만나요.</p></section><button class="primary wide" data-page="journal">나의 기록 보기 →</button><button class="text-button" data-page="home">오늘의 여정으로 돌아가기</button></section>`; }
document.addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b || b.disabled) return;
  if(b.dataset.page) render(b.dataset.page);
  if(b.dataset.stage) { stage=Number(b.dataset.stage); render('editor'); }
  if(b.dataset.action==='begin') {stage=0;render('editor');}
  if(b.dataset.action==='previous') {stage--;render('editor');}
  if(b.dataset.action==='next') {
    if(stage<3) {stage++;render('editor');}
    else if(fields.every(f=>current()[f]?.trim())) {entries[today]={...current(),completed:true}; const ok=persist();render('success');if(!ok)toast('기록이 메모리에만 있어요. 나의 기록에서 백업해 주세요.');}
    else toast('관찰, 해석, 적용을 모두 작성해 주세요.');
  }
  if(b.dataset.action==='export') { const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quolingo-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('묵상 기록을 파일로 저장했어요.'); }
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden && today!==dayKey()){today=dayKey();stage=0;render('home');toast('새로운 하루의 말씀을 준비했어요.');}});
render();
