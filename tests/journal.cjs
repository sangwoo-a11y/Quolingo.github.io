// Local browser records only: completion rewards, range deletion and storage rollback.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});await p.goto(url);
  const nav=page=>p.locator(`.nav[data-page="${page}"]`).click();
  const totals=async count=>assert.deepEqual(await p.locator('[data-stat=total]').allTextContents(),[String(count),String(count)]);
  const streak=async count=>assert.ok((await p.locator('[data-stat=streak]').allTextContents()).every(value=>value===String(count)));
  const remove=(start,end)=>p.locator(`[data-action=delete-entry][data-date="2026-10-20"][data-start="${start}"][data-end="${end}"]`);
  const confirmClick=async(button,accepted=true)=>{p.once('dialog',dialog=>accepted?dialog.accept():dialog.dismiss());await button.click();};
  await p.locator('.day-node[data-date="2026-10-20"]').click();await p.locator('#end-verse').selectOption('2');
  await p.locator('#passage-selection [type=submit]').click();await totals(0);await streak(0);
  await p.locator('#next').click();await totals(0);
  for(const value of ['관찰','해석','적용']){
   await p.locator('#reflection').fill(value);await totals(0);await p.locator('#next').click();
  }
  await totals(2);await streak(1);
  assert.equal(await p.locator('#week .day[data-date="2026-10-20"] .completion-check').count(),1);
  await nav('journal');
  assert.equal(await p.locator('[data-action=share-entry]').count(),0);
  assert.doesNotMatch(await p.locator('.entry small').textContent(),/✓|✔/);
  const saved=await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2'));
  await confirmClick(remove(1,2),false);await totals(2);await streak(1);
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2')),saved);
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='quolingo-chapters-v2')throw new Error('full');return window.originalSet.call(this,key,value);};});
  await confirmClick(remove(1,2));assert.equal(await p.locator('.entry').count(),1);await totals(2);
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2')),saved);
  await p.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});
  await confirmClick(remove(1,2));await totals(0);await streak(0);assert.equal(await p.locator('.entry').count(),0);
  await p.reload();await nav('journal');assert.equal(await p.locator('.entry').count(),0);await totals(0);
  // Overlapping completed ranges count once. Drafts and old chapter flags award no extra verses.
  await p.evaluate(()=>{
   const session=(start,end,completed)=>({start,end,read:Array.from({length:end-start+1},(_,i)=>start+i),completed,observation:'관찰',interpretation:'해석',application:'적용'});
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-20':{'joshua-1':{completed:true,observation:'old copy',read:[1,2,3,4,5],lastRange:{start:1,end:3},sessions:{'1-3':session(1,3,true),'3-4':session(3,4,true),'4-5':session(4,5,false)}}}}));
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-20':{chapters:['joshua-2'],rules:{completionRule:'qt',dailyGoal:1}}}));
   localStorage.setItem('quolingo-journal-v1',JSON.stringify({'2026-10-19':{completed:true,observation:'이전 기록',interpretation:'이전 해석',application:'이전 적용'}}));
  });await p.reload();await nav('journal');
  const reading=await p.evaluate(()=>CHAPTER_BY_ID.get('joshua-2').verses.length);
  await totals(reading+4);await streak(2);
  await confirmClick(remove(1,3));await totals(reading+2);await streak(2);
  const remaining=await p.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-chapters-v2'))['2026-10-20']['joshua-1']);
  assert.equal(Object.hasOwn(remaining,'completed'),false);assert.deepEqual(Object.keys(remaining.sessions),['3-4','4-5']);
  await confirmClick(remove(3,4));await totals(reading);await streak(1);
  assert.equal(await p.locator('#week .day[data-date="2026-10-20"] .completion-check').count(),0);
  await confirmClick(remove(4,5));
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-chapters-v2'))),{});
  assert.deepEqual(await p.evaluate(()=>readChapters()),['joshua-2']);await totals(reading);
  await confirmClick(p.locator('[data-action=delete-entry][data-legacy=true]'));await streak(0);
  await p.reload();await nav('journal');assert.equal(await p.locator('.entry').count(),0);await totals(reading);
  await nav('activity');assert.equal(await p.locator('.activity-stats .card').nth(1).locator('h2').textContent(),`${reading}절`);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: completion-only QT diamonds, first-day streak/check, mobile totals, overlapping range/draft/legacy deletion, confirmation cancellation, failed-storage rollback, unchanged chapter reading and reload persistence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
