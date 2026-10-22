// Exercise supplied local text, source numbering, saved preferences and durable rewards.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
const source=Object.fromEntries(['nkrv','rnksv'].map(version=>[version,JSON.parse(fs.readFileSync(path.join(__dirname,'../bible-data',version+'.json'),'utf8'))]));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});
  await p.goto(url);await p.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'번역 테스트',qtBookId:'1-samuel',readingBookId:'1-samuel'}));
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-19':{chapters:['1-samuel-30']},'2026-10-20':{chapters:['genesis-1']}}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-20':{'joshua-1':{sessions:{'1-2':{start:1,end:2,read:[1,2],completed:true,observation:'기존 관찰',interpretation:'기존 해석',application:'기존 적용'}}}}}));
  });await p.reload();
  const nav=value=>p.locator(`.nav[data-page=${value}]`).tap(),mode=value=>p.locator(`[data-mode=${value}]`).tap();
  const open=()=>p.locator('.day-node[data-date="2026-10-20"]').tap();
  const save=()=>p.locator('#account-form [type=submit]').tap();
  const saved=await p.evaluate(()=>({earned:allTimeCount(),streak:streak(),qt:localStorage.getItem('quolingo-chapters-v2')}));assert.equal(saved.earned,63);
  await nav('account');assert.equal(await p.locator('#bible-version').inputValue(),'krv');assert.deepEqual(await p.locator('#bible-version option').allTextContents(),['개역한글','개역개정','새번역']);
  await p.locator('#bible-version').selectOption('nkrv');await nav('home');await nav('account');assert.equal(await p.locator('#bible-version').inputValue(),'krv');
  let fail=true;await p.route('**/bible-data/nkrv.json',route=>{if(fail){fail=false;return route.fulfill({status:503,body:'unavailable'});}return route.continue();});
  for(const [version,name] of [['nkrv','개역개정'],['rnksv','새번역']]){
   await p.locator('#bible-version').selectOption(version);await save();assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned);assert.equal(await p.evaluate(()=>streak()),saved.streak);
   await nav('home');await mode('qt');await open();await p.locator('#chapter-select').selectOption('1-samuel-30');assert.equal(await p.locator('#end-verse option').last().getAttribute('value'),'31');await p.locator('#start-verse').selectOption('31');await p.locator('#end-verse').selectOption('31');await p.locator('#passage-selection [type=submit]').tap();
   if(version==='nkrv'){await p.locator('[data-action=bible-retry]').waitFor();assert.equal(await p.locator('.verse-row').count(),0);await p.locator('[data-action=bible-retry]').tap();}
   await p.locator('.verse-row').first().waitFor();assert.equal(await p.locator('.verse-row').count(),1);assert.equal(await p.locator('.verse-number').textContent(),'31');
   assert.equal(await p.locator('.verse-row>span:last-child').textContent(),source[version].chapters['1-samuel-30'].rows.at(-1)[2]);assert.equal(await p.locator('.official-bible-link').count(),0);assert.match(await p.locator('.reading-title p').textContent(),new RegExp(name));
   await p.locator('#next').tap();await p.locator('#reflection').fill('번역별 관찰');await p.locator('#next').tap();assert.equal(await p.locator('.reading-excerpt[open]').count(),0);await p.locator('.reading-excerpt summary').tap();assert.match(await p.locator('.reading-excerpt').textContent(),new RegExp(source[version].chapters['1-samuel-30'].rows.at(-1)[2].slice(0,9)));assert.match(await p.locator('.reflection-context').textContent(),/번역별 관찰/);
   await p.locator('#reflection').fill('번역별 해석');await p.locator('#next').tap();assert.equal(await p.locator('.reading-excerpt[open]').count(),0);
   await nav('home');await mode('reading');await open();await p.locator('#word-chapter').selectOption('1-samuel-30');await p.locator('#word-selection [type=submit]').tap();await p.locator('.verse-row').first().waitFor();assert.equal(await p.locator('.verse-row').count(),31);
   await p.locator('[data-action=read-chapter]').tap();assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned+31);assert.equal(await p.evaluate(()=>readingData[today].chapterVerseCounts['1-samuel-30']),31);
   await p.reload();await p.locator('.verse-row').first().waitFor();assert.equal(await p.evaluate(()=>profile.bibleVersion),version);assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned+31);assert.equal(await p.locator('.bible-version-name').textContent(),name);await p.screenshot({path:'/tmp/quolingo-native-'+version+'.png'});
   await p.locator('[data-action=read-chapter]').tap();assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned);await nav('account');
  }
  // KRV remains unchanged; changing edition must not retroactively change earned chapter totals.
  await p.locator('#bible-version').selectOption('krv');await save();await nav('home');await mode('reading');await open();await p.locator('#word-chapter').selectOption('1-samuel-30');await p.locator('#word-selection [type=submit]').tap();assert.equal(await p.locator('.verse-row').count(),30);await p.locator('[data-action=read-chapter]').tap();assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned+30);
  await nav('account');await p.locator('#bible-version').selectOption('rnksv');await p.locator('#qt-book').selectOption('revelation');await save();assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned+30);await nav('home');await mode('qt');await open();await p.locator('#chapter-select').selectOption('revelation-12');await p.locator('#start-verse').selectOption('18');await p.locator('#end-verse').selectOption('18');await p.locator('#passage-selection [type=submit]').tap();assert.match(await p.locator('.verse-row').textContent(),/바닷가 모래/);await p.locator('#next').tap();for(const value of ['관찰','해석','적용']){await p.locator('#reflection').fill(value);await p.locator('#next').tap();}assert.equal(await p.evaluate(()=>page),'success');assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned+31);
  // A merged range is shown once; a missing source verse is explicit and never borrowed from KRV.
  await nav('account');await p.locator('#bible-version').selectOption('nkrv');await p.locator('#qt-book').selectOption('deuteronomy');await save();await nav('home');await mode('qt');await open();await p.locator('#chapter-select').selectOption('deuteronomy-6');await p.locator('#start-verse').selectOption('18');await p.locator('#end-verse').selectOption('19');await p.locator('#passage-selection [type=submit]').tap();await p.locator('.verse-row').first().waitFor();assert.equal(await p.locator('.verse-row').count(),1);assert.equal(await p.locator('.verse-number').textContent(),'18–19');
  await nav('account');await p.locator('#qt-book').selectOption('acts');await save();await nav('home');await open();await p.locator('#chapter-select').selectOption('acts-24');await p.locator('#start-verse').selectOption('7');await p.locator('#end-verse').selectOption('7');await p.locator('#passage-selection [type=submit]').tap();await p.locator('.verse-row').first().waitFor();assert.match(await p.locator('.verse-row').textContent(),/이 파일에 해당 절의 본문이 없습니다/);
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.deepEqual(await p.evaluate(()=>data['2026-10-20']['joshua-1']),JSON.parse(saved.qt)['2026-10-20']['joshua-1']);assert.deepEqual(errors,[]);
  console.log('PASS: local editions in QT/read/context, retry without mislabeled fallback, source-specific verse numbering, combined/missing verses, reload, new verse rewards and unchanged historical totals/records.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
