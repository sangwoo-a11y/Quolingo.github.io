// Preserve earned streaks across settings changes without awarding unfinished days.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});await p.goto(url);
  const nav=page=>p.locator(`.nav[data-page="${page}"]`).click();
  const save=()=>p.locator('#account-form [type=submit]').click();
  const count=async n=>assert.ok((await p.locator('[data-stat=streak]').allTextContents()).every(value=>value===String(n)));
  await p.evaluate(()=>{
   const qt={read:[1],sessions:{'1-1':{start:1,end:1,read:[1],completed:true,observation:'관찰',interpretation:'해석',application:'적용'}}};
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'기록',completionRule:'qt',dailyGoal:1,skipSundayQt:true}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify(Object.fromEntries(['2026-10-17','2026-10-19','2026-10-20'].map(date=>[date,{'joshua-1':qt}]))));
  });await p.reload();await count(3);await nav('account');
  await p.locator('#completion-rule').selectOption('both');await p.locator('#daily-goal').fill('3');await p.locator('#skip-sunday-qt').uncheck();await save();
  await count(3);
  assert.equal(await p.locator('#week .day[data-date="2026-10-20"] .completion-check').count(),1);
  await p.locator('#daily-goal').fill('8');await save();await count(3);
  assert.equal(await p.evaluate(()=>daySettings('2026-10-18').skipSundayQt),true);
  assert.equal(await p.evaluate(()=>dailyState('2026-10-18').rest),true);
  await p.reload();await count(3);
  await p.clock.setSystemTime(new Date('2026-10-21T03:00:00Z'));await p.reload();await count(3);
  assert.equal(await p.evaluate(()=>dailyState(today).complete),false);
  assert.equal(await p.evaluate(()=>dailyState('2026-10-20').complete),true);
  // Older chapter-only records without snapshots keep their former one-chapter goal.
  await p.clock.setSystemTime(new Date('2026-10-20T03:00:00Z'));
  await p.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'읽기 기록',completionRule:'reading',dailyGoal:1}));
   localStorage.setItem('quolingo-chapters-v2','{}');localStorage.setItem('quolingo-journal-v1','{}');
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-19':{chapters:['joshua-1']},'2026-10-20':{chapters:['joshua-1']}}));
  });await p.reload();await count(2);await nav('account');
  const before=await p.evaluate(()=>({profile:localStorage.getItem('quolingo-profile-v1'),reading:localStorage.getItem('quolingo-reading-v1')}));
  await p.locator('#completion-rule').selectOption('both');await p.locator('#daily-goal').fill('4');
  await p.evaluate(()=>{window.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='quolingo-profile-v1')throw new Error('full');return window.oldSet.call(this,key,value);};});
  await save();
  assert.deepEqual(await p.evaluate(()=>({profile:localStorage.getItem('quolingo-profile-v1'),reading:localStorage.getItem('quolingo-reading-v1')})),before);await count(2);
  await p.evaluate(()=>{Storage.prototype.setItem=window.oldSet;});await save();await count(2);
  assert.equal(await p.evaluate(()=>daySettings('2026-10-19').dailyGoal),1);
  assert.equal(await p.evaluate(()=>daySettings('2026-10-19').completionRule),'reading');
  await p.reload();await count(2);await nav('home');await p.locator('[data-mode=reading]').click();
  await p.locator('.day-node[data-date="2026-10-20"]').click();await p.locator('#word-chapter').selectOption('joshua-1');await p.locator('#word-selection [type=submit]').click();
  await p.locator('[data-action=read-chapter]').click();await count(1);
  assert.equal(await p.evaluate(()=>dailyState(today).complete),false);
  await p.locator('[data-action=read-chapter]').click();await count(2);
  assert.equal(await p.evaluate(()=>dailyState(today).complete),true);
  // The next day's new QT + four-chapter requirement must actually be met.
  await p.clock.setSystemTime(new Date('2026-10-21T03:00:00Z'));await p.reload();await count(2);
  await p.evaluate(()=>{
   const qt={read:[1],sessions:{'1-1':{start:1,end:1,read:[1],completed:true,observation:'관찰',interpretation:'해석',application:'적용'}}};
   const chapters=JSON.parse(localStorage.getItem('quolingo-chapters-v2'));
   chapters['2026-10-21']={'joshua-1':qt};localStorage.setItem('quolingo-chapters-v2',JSON.stringify(chapters));
   const reading=JSON.parse(localStorage.getItem('quolingo-reading-v1'));
   reading['2026-10-21']={chapters:['joshua-1','joshua-2','joshua-3']};localStorage.setItem('quolingo-reading-v1',JSON.stringify(reading));
  });await p.reload();await count(2);assert.equal(await p.evaluate(()=>dailyState(today).complete),false);
  await nav('home');await p.locator('[data-mode=reading]').click();await p.locator('.day-node[data-date="2026-10-21"]').click();
  await p.locator('#word-chapter').selectOption('joshua-4');await p.locator('#word-selection [type=submit]').click();await p.locator('[data-action=read-chapter]').click();await count(3);
  await p.reload();await count(3);assert.deepEqual(errors,[]);
  console.log('PASS: QT-only to both, higher chapter goals, missing historical snapshots, Sunday rest preservation, saved/reloaded streaks, failed-save rollback, explicit cancellation/restoration and strict future-day completion.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
