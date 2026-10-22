// Official reader navigation is intercepted; no Bible text is fetched or republished.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});
  await p.context().route('https://www.bskorea.or.kr/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Mock official reader</title>'}));
  await p.goto(url);await p.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'번역 테스트',qtBookId:'joshua',readingBookId:'genesis'}));
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-20':{chapters:['genesis-1']}}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-20':{'joshua-1':{sessions:{'1-2':{start:1,end:2,read:[1,2],completed:true,observation:'기존 관찰',interpretation:'기존 해석',application:'기존 적용'}}}}}));
  });await p.reload();
  const nav=value=>p.locator(`.nav[data-page=${value}]`).tap(),mode=value=>p.locator(`[data-mode=${value}]`).tap();
  const open=()=>p.locator('.day-node[data-date="2026-10-20"]').tap();
  const saved=await p.evaluate(()=>({earned:allTimeCount(),streak:streak(),qt:localStorage.getItem('quolingo-chapters-v2')}));
  await nav('account');assert.equal(await p.locator('#bible-version').inputValue(),'krv');
  assert.deepEqual(await p.locator('#bible-version option').evaluateAll(els=>els.map(el=>el.value)),['krv','nkrv','rnksv']);
  await p.locator('#bible-version').selectOption('nkrv');assert.equal(await p.evaluate(()=>profile.bibleVersion),'krv');
  await nav('home');await nav('account');assert.equal(await p.locator('#bible-version').inputValue(),'krv');
  for(const [version,name,code] of [['nkrv','개역개정','GAE'],['rnksv','새번역','SAENEW']]){
   await p.locator('#bible-version').selectOption(version);await p.locator('#account-form [type=submit]').tap();
   assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned);assert.equal(await p.evaluate(()=>streak()),saved.streak);
   assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-chapters-v2'))['2026-10-20']['joshua-1']),JSON.parse(saved.qt)['2026-10-20']['joshua-1']);
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-profile-v1')).bibleVersion),version);
   await nav('home');await mode('qt');await open();await p.locator('#chapter-select').selectOption('joshua-6');await p.locator('#start-verse').selectOption('3');await p.locator('#end-verse').selectOption('5');await p.locator('#passage-selection [type=submit]').tap();
   assert.match(await p.locator('.reading-title p').textContent(),new RegExp(name));assert.equal(await p.locator('.verse-row').count(),0);
   const link=p.locator('.official-bible-link'),target=new URL(await link.getAttribute('href'));
   assert.equal(target.searchParams.get('version'),code);assert.equal(target.searchParams.get('book'),'jos');assert.equal(target.searchParams.get('chap'),'6');assert.equal(target.searchParams.get('sec'),'3');
   const popupPromise=p.waitForEvent('popup');await link.tap();const popup=await popupPromise;await popup.waitForLoadState();assert.equal(await popup.title(),'Mock official reader');await popup.close();
   await p.locator('#next').tap();await p.locator('#reflection').fill('번역별 관찰');await p.locator('#next').tap();
   assert.equal(await p.locator('.reading-excerpt[open]').count(),0);await p.locator('.reading-excerpt summary').tap();assert.equal(await p.locator('.reading-excerpt .official-bible-link').getAttribute('href'),target.href);assert.match(await p.locator('.reflection-context').textContent(),/번역별 관찰/);
   await p.locator('#reflection').fill('번역별 해석');await p.locator('#next').tap();assert.equal(await p.locator('.reading-excerpt[open]').count(),0);assert.match(await p.locator('.reflection-context').textContent(),/번역별 해석/);
   await nav('home');await mode('reading');await open();await p.locator('#word-chapter').selectOption('genesis-2');await p.locator('#word-selection [type=submit]').tap();
   const reading=new URL(await p.locator('.official-bible-link').getAttribute('href'));assert.equal(reading.searchParams.get('book'),'gen');assert.equal(reading.searchParams.get('chap'),'2');assert.equal(reading.searchParams.get('version'),code);assert.equal(reading.searchParams.get('sec'),'1');
   await p.reload();assert.equal(await p.evaluate(()=>profile.bibleVersion),version);assert.equal(await p.locator('.verse-row').count(),0);assert.equal(await p.locator('.bible-version-name').textContent(),name);
   await p.screenshot({path:'/tmp/quolingo-official-bible.png'});await nav('account');
  }
  await p.screenshot({path:'/tmp/quolingo-bible-account.png',fullPage:true});
  await p.locator('#bible-version').selectOption('krv');await p.locator('#account-form [type=submit]').tap();await nav('home');await mode('reading');await open();await p.locator('#word-chapter').selectOption('genesis-2');await p.locator('#word-selection [type=submit]').tap();
  assert.equal(await p.locator('.official-bible-link').count(),0);assert.equal(await p.locator('.verse-row').count(),25);assert.match(await p.locator('.verse-row').first().textContent(),/천지와 만물/);
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.equal(await p.evaluate(()=>allTimeCount()),saved.earned);assert.deepEqual(errors,[]);
  console.log('PASS: saved-only version preferences, legacy KRV default, official NKRV/RNKSV chapter/range links, mocked new tabs, folded QT context, reading/reload and unchanged records/rewards.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
