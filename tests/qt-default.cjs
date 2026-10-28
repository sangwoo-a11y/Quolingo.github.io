// Only local fixture journals; opening QT must never copy old reflections or rewards.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-28T03:00:00Z')});await p.goto(url);
  await p.evaluate(()=>{
   const entry=(start,end,completed=true)=>({lastRange:{start,end},sessions:{[`${start}-${end}`]:{start,end,completed,read:[start],observation:'OLD_OBSERVATION',interpretation:'OLD_INTERPRETATION',application:'OLD_APPLICATION'}}});
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'QT 테스트',qtBookId:'joshua'}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({
    '2026-10-24':{'joshua-6':entry(3,5)},
    '2026-10-26':{'joshua-23':entry(8,12)},
    '2026-10-27':{'joshua-24':entry(1,4),'matthew-28':entry(8,10)},
    '2026-10-29':{'joshua-1':entry(1,18)},
    'not-a-date':{'joshua-2':entry(1,2)}
   }));
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-27':{chapters:['joshua-3']}}));
  });await p.reload();
  const nav=value=>p.locator(`.nav[data-page=${value}]`).tap();
  const open=date=>p.locator(`.day-node[data-date="${date}"]`).tap();
  const selection=async(id,start,end,date)=>{
   assert.equal(await p.locator('#chapter-select').inputValue(),id);assert.equal(await p.locator('#start-verse').inputValue(),String(start));assert.equal(await p.locator('#end-verse').inputValue(),String(end));
   assert.deepEqual(await p.evaluate(()=>({page,selectedDate})),{page:'selection',selectedDate:date});
  };
  const before=await p.evaluate(()=>({qt:localStorage.getItem('quolingo-chapters-v2'),reading:localStorage.getItem('quolingo-reading-v1'),total:allTimeCount()}));
  await open('2026-10-28');await selection('joshua-24',1,4,'2026-10-28');
  assert.deepEqual(await p.evaluate(()=>({qt:localStorage.getItem('quolingo-chapters-v2'),reading:localStorage.getItem('quolingo-reading-v1'),total:allTimeCount()})),before);
  await p.reload();await selection('joshua-24',1,4,'2026-10-28');
  await p.locator('#passage-selection [type=submit]').tap();assert.equal(await p.locator('.verse-row').count(),4);await p.locator('#next').tap();assert.equal(await p.locator('#reflection').inputValue(),'');
  assert.equal(await p.evaluate(()=>allTimeCount()),before.total);assert.equal(await p.evaluate(()=>data[today]['joshua-24'].sessions['1-4'].observation),undefined);
  await nav('home');await open('2026-10-25');await selection('joshua-6',3,5,'2026-10-25');
  // Same-day drafts have priority over old completed passages and same-day completed chapters.
  await p.evaluate(()=>{
   const completed={start:1,end:2,read:[1,2],completed:true,observation:'completed'};
   const draft={start:7,end:9,read:[7],observation:'TODAY_DRAFT'};
   data[today]={'joshua-20':{lastRange:{start:1,end:2},sessions:{'7-9':draft,'1-2':completed}},'joshua-4':{lastRange:{start:1,end:2},sessions:{'1-2':completed}}};
   accountStore.setItem(KEY,JSON.stringify(data));render('home');
  });await open('2026-10-28');await selection('joshua-20',7,9,'2026-10-28');
  await p.locator('#passage-selection [type=submit]').tap();await p.locator('#next').tap();assert.equal(await p.locator('#reflection').inputValue(),'TODAY_DRAFT');
  // Older migrated sessions work without lastRange, and invalid records are ignored.
  await p.evaluate(()=>{
   delete data[today];data['2026-10-27']={'joshua-8':{lastRange:{start:999,end:999},sessions:{'8-10':{start:8,end:10,completed:true,observation:'saved'},'999-999':{start:999,end:999,completed:true}}}};
   accountStore.setItem(KEY,JSON.stringify(data));render('home');
  });await open('2026-10-28');await selection('joshua-8',8,10,'2026-10-28');
  await nav('account');await p.locator('#qt-book').selectOption('luke');await p.locator('#account-form [type=submit]').tap();await nav('home');await open('2026-10-28');await selection('luke-1',1,80,'2026-10-28');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS: recent historical QT range prefills only, selected-book/date isolation, no journal/reward copying, reload, current-day drafts, missing/invalid range metadata and first-chapter fallback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
