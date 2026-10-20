// Real UI checks for the calendar, reading cancellation and derived totals.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});await p.goto(url);
  await p.evaluate(()=>{
   const rules={dailyGoal:2,completionRule:'both',skipSundayQt:false};
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({...rules,qtBookId:'john',readingBookId:'genesis'}));
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({
    '2026-09-30':{rules,chapters:['john-1']},
    '2026-10-19':{rules,chapters:['genesis-1','genesis-2']},
    '2026-10-20':{rules,chapters:['genesis-1','john-1']}
   }));
   const qt={read:[1],sessions:{'1-1':{start:1,end:1,read:[1],completed:true,observation:'관찰',interpretation:'해석',application:'적용'}}};
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-19':{'john-1':qt},'2026-10-20':{'john-1':qt}}));
  });await p.reload();
  const nav=page=>p.locator(`.nav[data-page="${page}"]`).click();
  const day=date=>p.locator(`.calendar-day[data-date="${date}"]`);
  const book=id=>p.locator(`.book-reading-list [data-book="${id}"] strong`);
  const check=date=>p.locator(`#week .day[data-date="${date}"] .completion-check`);
  const select=date=>day(date).click();
  assert.equal((await p.locator('.nav[data-page=home]').textContent()).trim(),'🏡홈');
  assert.doesNotMatch(await p.locator('#content').textContent(),/말씀 여행/);
  await nav('activity');
  assert.equal(await day('2026-10-20').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('.calendar-day').count(),31);
  assert.equal(await p.locator('.calendar-blank').count(),3); // Thursday, Monday-first grid.
  assert.equal(await day('2026-10-21').isDisabled(),true);
  assert.equal(await p.locator('.calendar-completion .completion-check').count(),2);
  assert.match(await p.locator('.month-totals').textContent(),/하루 완료 2일QT 2일말씀 4장/);
  assert.match(await p.locator('.calendar-detail').textContent(),/창세기 1장/);
  assert.match(await p.locator('.calendar-detail').textContent(),/요한복음 1장/);
  assert.equal(await book('genesis').textContent(),'3장');assert.equal(await book('john').textContent(),'2장');
  assert.equal(await p.locator('.chapter-summary').count(),0);
  assert.doesNotMatch(await p.locator('#content').textContent(),/오늘의 QT 읽기/);
  // Cancelling one chapter changes the goal/streak/calendar, without changing QT.
  const qtBefore=await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2'));
  await p.locator('[data-action=unread-chapter][data-reading-id="john-1"]').click();
  assert.equal(await day('2026-10-20').locator('.completion-check').count(),0);
  assert.equal(await check('2026-10-20').count(),0);
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'1 / 2장');
  assert.equal(await book('john').textContent(),'1장');
  assert.match(await p.locator('.month-totals').textContent(),/하루 완료 1일QT 2일말씀 3장/);
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2')),qtBefore);
  await p.reload();await nav('activity');
  assert.equal(await p.locator('.daily-reading-list li').count(),1); // Persists after reload.
  // Historical cancellation preserves that day's stored completion criteria.
  await select('2026-10-19');
  await p.locator('[data-action=unread-chapter][data-reading-id="genesis-2"]').click();
  assert.equal(await check('2026-10-19').count(),0);assert.equal(await p.locator('#streak').textContent(),'0');
  assert.equal(await p.evaluate(()=>daySettings('2026-10-19').completionRule),'both');
  assert.equal(await book('genesis').textContent(),'2장');
  await p.locator('[data-action=activity-month][data-shift="-1"]').click();
  assert.equal(await p.locator('.calendar-day').count(),30);
  await select('2026-09-30');assert.match(await p.locator('.calendar-detail').textContent(),/요한복음 1장/);
  await p.locator('[data-action=unread-chapter]').click();assert.equal(await book('john').count(),0);
  await p.locator('[data-action=activity-month][data-shift="1"]').click();
  assert.equal(await day('2026-10-20').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('[data-action=activity-month][data-shift="1"]').isDisabled(),true);
  // Local storage errors must not remove a record from memory or disk.
  const before=await p.evaluate(()=>JSON.stringify(readingData));
  await p.evaluate(()=>{
   window.originalSetItem=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key==='quolingo-reading-v1')throw new DOMException('full','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
  });
  await p.locator('[data-action=unread-chapter]').click();
  assert.equal(await p.evaluate(()=>JSON.stringify(readingData)),before);
  assert.match(await p.locator('#toast').textContent(),/저장할 수 없어요/);
  await p.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
  // Reader cancellation can be reversed by marking the same chapter again.
  await nav('home');await p.locator('[data-mode=reading]').click();await p.locator('.day-node[data-date="2026-10-20"]').click();
  await p.locator('#word-chapter').selectOption('genesis-1');await p.locator('#word-selection button').click();
  assert.equal(await p.locator('[data-action=read-chapter]').isDisabled(),true);
  await p.locator('[data-action=unread-chapter]').click();
  assert.equal(await p.locator('[data-action=read-chapter]').isDisabled(),false);
  assert.equal(await p.locator('[data-action=unread-chapter]').count(),0);
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'0 / 2장');
  await p.locator('[data-action=read-chapter]').click();
  assert.equal(await p.locator('#reading-goal .goal-count').textContent(),'1 / 2장');
  assert.equal(await p.locator('[data-action=next-chapter]').textContent(),'다음 장 읽기');
  assert.doesNotMatch(await p.locator('#content').textContent(),/말씀 여행|→|↗|←/);
  await nav('activity');await p.screenshot({path:'/tmp/quolingo-activity-desktop.png',fullPage:true});
  for(const width of [320,390,580,768,1440]){
   await p.setViewportSize({width,height:900});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no overflow at ${width}`);
   if(width<=580){
    const logo=await p.locator('.mobile-logo').boundingBox();assert.ok(logo&&logo.x<30&&logo.y<30);
    await select('2026-10-19');assert.match(await p.locator('.calendar-detail').textContent(),/창세기/);
   }
   if(width===390)await p.screenshot({path:'/tmp/quolingo-activity-mobile.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: monthly calendar/history, per-book cumulative counts, same-day/old-day/reader cancellation, persistence, goal/streak recalculation, QT preservation, failed storage rollback, mobile logo and 320–1440px layouts.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
