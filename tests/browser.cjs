// Run against `python3 -m http.server 8080` with Playwright + Chromium installed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});
  await p.goto(url);
  await p.evaluate(()=>{
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-19':{'joshua-1':{read:[1],completed:true,observation:'기존 관찰',interpretation:'기존 해석',application:'기존 적용'}}}));
  });
  await p.reload();
  const nav=page=>p.locator(`.nav[data-page="${page}"]`).click();
  const day=date=>p.locator(`.day-node[data-date="${date}"]`);
  const week=date=>p.locator(`#week .day[data-date="${date}"] i`);
  const mode=value=>p.locator(`[data-action="mode"][data-mode="${value}"]`).click();
  const readDate=async(date,id)=>{
   await nav('home');await mode('reading');await day(date).click();
   await p.locator('#word-chapter').selectOption(id);await p.locator('#word-selection button[type="submit"]').click();
   await p.locator('[data-action="read-chapter"]').click();
  };
  assert.equal(await p.locator('.day-node').count(),31);
  assert.equal(await p.locator('.mode-tabs').evaluate(el=>el.previousElementSibling.className),'unit');
  assert.equal(await p.locator('[data-mode="qt"]').getAttribute('aria-pressed'),'true');
  await nav('account');
  assert.equal(await p.locator('#qt-book option').count(),66);
  assert.equal(await p.locator('#reading-book option').count(),66);
  assert.equal(await p.locator('#reading-book optgroup[label="구약"] option').count(),39);
  assert.equal(await p.locator('#reading-book optgroup[label="신약"] option').count(),27);
  assert.equal(await p.locator('#completion-rule').inputValue(),'qt');
  // Preferences save without requiring a profile name.
  await p.locator('#reading-book').selectOption('genesis');
  await p.locator('#qt-book').selectOption('matthew');
  await p.locator('#daily-goal').fill('2');await p.locator('#daily-goal').dispatchEvent('change');
  await p.locator('#completion-rule').selectOption('both');
  await p.reload();await nav('account');
  assert.equal(await p.locator('#reading-book').inputValue(),'genesis');
  assert.equal(await p.locator('#qt-book').inputValue(),'matthew');
  assert.equal(await p.locator('#daily-goal').inputValue(),'2');
  assert.equal(await p.locator('#completion-rule').inputValue(),'both');
  await readDate('2026-10-20','genesis-1');
  assert.equal(await p.locator('.verse-row').count(),31);
  assert.match(await p.locator('.verse-row').first().textContent(),/태초에 하나님이 천지를/);
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'1 / 2장');
  assert.equal(await p.locator('#total').textContent(),'0');
  assert.equal(await week('2026-10-20').textContent(),'·');
  assert.equal(await p.locator('[data-action="read-chapter"]').isDisabled(),true);
  await nav('home');await mode('reading');await day('2026-10-20').click();
  assert.equal(await p.locator('#word-chapter').inputValue(),'genesis-2');
  // A repeated chapter counts only once on a given date.
  await p.locator('#word-chapter').selectOption('genesis-1');await p.locator('#word-selection button').click();
  assert.equal(await p.locator('[data-action="read-chapter"]').isDisabled(),true);
  await readDate('2026-10-20','genesis-2');
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'2 / 2장');
  assert.equal(await week('2026-10-20').textContent(),'·');
  await nav('home');await mode('reading');assert.equal(await day('2026-10-20').locator('.completion-check').count(),1);
  await mode('qt');assert.match(await p.locator('.unit small').textContent(),/마태복음/);assert.equal(await day('2026-10-20').locator('.completion-check').count(),0);
  await day('2026-10-20').click();await p.locator('#end-verse').selectOption('2');await p.locator('#passage-selection button').click();
  assert.equal(await p.locator('.verse-row').count(),2);await p.locator('#next').click();
  const reflection=['관찰 기록','해석 기록','적용 기록'];
  for(let i=0;i<3;i++){
   if(i>0){assert.equal(await p.locator('.reading-excerpt[open]').count(),1);assert.match(await p.locator('.reflection-context').textContent(),new RegExp(reflection[i-1]));}
   await p.locator('#reflection').fill(reflection[i]);await p.locator('#next').click();
  }
  assert.equal(await week('2026-10-20').locator('.completion-check').count(),1);
  await p.locator('.success [data-action="open-share"]').click();
  assert.equal(await p.locator('#share-dialog').isVisible(),true);
  assert.equal(await p.locator('#share-application').isChecked(),false);
  assert.match(await p.locator('#share-preview').inputValue(),/관찰 기록/);
  assert.doesNotMatch(await p.locator('#share-preview').inputValue(),/적용 기록/);
  await p.locator('[data-action="close-share"]').click();
  assert.equal(await p.locator('#streak').textContent(),'2'); // Legacy day stays complete under its previous rule.
  assert.equal(await p.locator('#total').textContent(),'2');
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'2 / 2장');
  await nav('home');assert.equal(await day('2026-10-20').locator('.completion-check path').getAttribute('stroke-width'),'6');
  assert.equal(await week('2026-10-20').locator('.completion-check path').getAttribute('stroke-width'),'6');
  assert.equal(await week('2026-10-20').locator('path').getAttribute('d'),await day('2026-10-20').locator('.completion-check path').getAttribute('d'));
  await nav('account');
  assert.equal(await p.locator('label[for=qt-book]').textContent(),'큐티말씀');
  assert.deepEqual(await p.locator('#completion-rule option').evaluateAll(options=>options.map(o=>o.value)),['both','qt','reading']);
  await p.locator('#daily-goal').fill('3');await p.locator('#daily-goal').dispatchEvent('change');
  assert.equal(await week('2026-10-20').textContent(),'·'); // Both still requires the increased reading goal.
  await p.locator('#completion-rule').selectOption('reading');assert.equal(await week('2026-10-20').textContent(),'·');
  await p.locator('#completion-rule').selectOption('qt');assert.equal(await week('2026-10-20').locator('.completion-check').count(),1);
  await p.locator('#completion-rule').selectOption('both');assert.equal(await week('2026-10-20').textContent(),'·');
  await readDate('2026-10-20','genesis-3');assert.equal(await week('2026-10-20').locator('.completion-check').count(),1);
  // Completed records can come from different books; switching books doesn't reset totals.
  await nav('account');await p.locator('#reading-book').selectOption('revelation');
  await readDate('2026-10-20','revelation-22');
  assert.equal(await p.locator('.verse-row').count(),21);
  assert.match(await p.locator('.verse-row').last().textContent(),/주 예수의 은혜가/);
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'4 / 3장');
  await readDate('2026-10-19','revelation-22');
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'4 / 3장');
  assert.match(await p.locator('.reader-count').textContent(),/1장/);
  await nav('activity');
  assert.match(await p.locator('#content').textContent(),/누적 5장/);
  assert.match(await p.locator('.activity-stats .card').nth(1).textContent(),/3절/);
  await nav('home');
  assert.equal(await p.locator('.month-path .friend-character').count(),7);
  assert.equal(await p.locator('.week-companion .friends-cast').first().evaluate(el=>getComputedStyle(el).transform),'none');
  const hands=p.locator('.month-path .friend-hand');
  const names=await hands.evaluateAll(elements=>elements.map(el=>getComputedStyle(el).animationName));
  assert.equal(new Set(names).size,3);
  const frames=await hands.evaluateAll(elements=>elements.map(el=>{
   const animation=el.getAnimations()[0],timing=animation.effect.getTiming();
   animation.pause();animation.currentTime=timing.delay+timing.duration*.32;
   const first=getComputedStyle(el).transform;
   animation.currentTime=timing.delay+timing.duration*.4;
   return [first,getComputedStyle(el).transform];
  }));
  for(const [first,second] of frames)assert.notEqual(first,second);
  const bodies=await p.locator('.month-path .friend-motion').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).animationName));
  assert.equal(new Set(bodies).size,3);
  await p.emulateMedia({reducedMotion:'reduce'});
  for(const value of await p.locator('.month-path :is(.friend-motion,.friend-hand)').evaluateAll(elements=>elements.map(el=>getComputedStyle(el).animationName)))assert.equal(value,'none');
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(50);
  assert.ok(await p.locator('.day-caption').last().evaluate(el=>innerHeight-el.getBoundingClientRect().bottom)>=150);
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(50);
  const bottom=await p.locator('.day-caption').last().boundingBox(),navbar=await p.locator('.sidebar').boundingBox();
  assert.ok(navbar.y-bottom.y-bottom.height>=100);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await nav('home');assert.equal(await p.locator('.mobile-goal').isVisible(),true);
  await p.screenshot({path:'/tmp/quolingo-final-mobile.png'});
  await p.setViewportSize({width:1440,height:1000});await nav('account');
  await p.locator('#profile-name').fill('상우');await p.locator('[type="submit"]').click();
  await p.reload();await nav('account');assert.equal(await p.locator('#profile-name').inputValue(),'상우');
  assert.equal(await p.locator('#daily-goal').inputValue(),'3');
  const download=p.waitForEvent('download');await p.locator('[data-action="export"]').click();
  const file=await download;await file.saveAs('/tmp/quolingo-final-backup.json');
  const backup=JSON.parse(fs.readFileSync('/tmp/quolingo-final-backup.json','utf8'));
  assert.equal(backup.version,4);assert.equal(backup.profile.qtBookId,'matthew');assert.equal(backup.profile.readingBookId,'revelation');assert.equal(backup.reading['2026-10-20'].chapters.length,4);
  assert.equal(backup.chapters['2026-10-20']['matthew-1'].sessions['1-2'].application,'적용 기록');
  assert.equal(backup.chapters['2026-10-19']['joshua-1'].observation,'기존 관찰');
  await nav('home');await p.screenshot({path:'/tmp/quolingo-final-desktop.png'});
  // Sunday: QT-only is a rest, reading stays enabled, no artificial completion check.
  await p.clock.setSystemTime(new Date('2026-10-25T03:00:00Z'));await p.reload();await nav('account');
  await p.locator('#completion-rule').selectOption('qt');await p.locator('#skip-sunday-qt').check();
  await nav('home');assert.equal(await day('2026-10-25').isDisabled(),true);
  assert.equal(await week('2026-10-25').textContent(),'–');
  await mode('reading');assert.equal(await day('2026-10-25').isDisabled(),false);
  await readDate('2026-10-25','revelation-1');assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'1 / 3장');
  await nav('account');await p.locator('#completion-rule').selectOption('both');
  await p.locator('#daily-goal').fill('1');await p.locator('#daily-goal').dispatchEvent('change');
  assert.equal(await week('2026-10-25').locator('.completion-check').count(),1);
  await p.locator('#skip-sunday-qt').uncheck();assert.equal(await week('2026-10-25').textContent(),'·');
  await p.locator('#skip-sunday-qt').check();
  // Goal changes from Monday onward preserve Sunday's goal and completion.
  await p.clock.setSystemTime(new Date('2026-10-26T03:00:00Z'));await p.reload();await nav('account');
  await p.locator('#daily-goal').fill('5');await p.locator('#daily-goal').dispatchEvent('change');
  assert.equal(await p.evaluate(()=>dailyState('2026-10-25').complete),true);
  assert.equal(await p.evaluate(()=>daySettings('2026-10-25').dailyGoal),1);
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'0 / 5장');
  // A retired profile choice migrates, but yesterday's achieved reading-only day remains achieved.
  const oldContext=await browser.newContext();const old=await oldContext.newPage();
  await old.clock.install({time:new Date('2026-10-20T03:00:00Z')});await old.goto(url);
  await old.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({completionRule:'either',dailyGoal:2}));
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-19':{chapters:['genesis-1'],rules:{dailyGoal:1,completionRule:'either'}}}));
  });await old.reload();await old.locator('.nav[data-page="account"]').click();
  assert.equal(await old.locator('#completion-rule').inputValue(),'both');
  assert.equal(await old.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-profile-v1')).completionRule),'both');
  assert.equal(await old.evaluate(()=>dailyState('2026-10-19').complete),true);
  assert.equal(await old.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-reading-v1'))['2026-10-19'].rules.completionRule),'either');
  await oldContext.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: 66 books, mode routing, independent/deduplicated chapter records, QT context and legacy migration, three current completion choices and retired-choice migration, daily goal persistence/history, Sunday exemption, backup, independently animated waving arms and bodies, mobile layout and bottom spacing.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
