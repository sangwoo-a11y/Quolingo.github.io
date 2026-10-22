// Local fake reading records and mocked dialogs: no remote purchases or user data.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});await p.goto(url);
  const nav=page=>p.locator(`.nav[data-page=${page}]`).tap();
  const category=value=>p.locator(`[data-action=shop-category][data-category=${value}]`).tap();
  const character=value=>p.locator(`[data-action=shop-character][data-character=${value}]`).tap();
  const balance=()=>p.evaluate(()=>diamondBalance());
  const totals=async value=>assert.deepEqual(await p.locator('[data-stat=total]').allTextContents(),[String(value),String(value)]);
  const buy=async(id,accept=true)=>{p.once('dialog',d=>accept?d.accept():d.dismiss());await p.locator('#shop-'+id).tap();};
  await nav('customize');assert.equal(await p.locator('#shop-meadow').isDisabled(),true);
  await p.locator('[data-action=shop-preview][data-item=starlight]').tap();assert.equal(await p.locator('.shop-stage .scene-starlight').count(),1);await totals(0);
  await nav('home');assert.equal(await p.locator('.home-decoration .scene-starlight').count(),0);assert.equal(await p.locator('#content [data-page=customize]').count(),0);
  await p.evaluate(()=>{
   localStorage.setItem('quolingo-reading-v1',JSON.stringify({'2026-10-19':{chapters:Array.from({length:20},(_,i)=>'genesis-'+(i+1))}}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-20':{'joshua-1':{sessions:{'1-2':{start:1,end:2,read:[1,2],completed:true,observation:'관찰',interpretation:'해석',application:'적용'},'3-4':{start:3,end:4,read:[3,4],completed:false,observation:'초안'}}}}}));
  });await p.reload();const earned=await p.evaluate(()=>allTimeCount());assert.ok(earned>300);await totals(earned);
  const reading=await p.evaluate(()=>localStorage.getItem('quolingo-reading-v1')),qt=await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2'));
  await nav('customize');const before=await p.evaluate(()=>localStorage.getItem('quolingo-profile-v1'));
  await buy('meadow',false);assert.equal(await balance(),earned);assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-profile-v1')),before);
  // Storage failures must not spend currency or grant items in memory.
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='quolingo-profile-v1')throw Error('full');return window.originalSet.call(this,k,v);};});
  await buy('meadow');assert.equal(await balance(),earned);assert.equal(await p.evaluate(()=>profile.decorations.owned.meadow),undefined);
  await p.evaluate(()=>Storage.prototype.setItem=window.originalSet);
  await buy('meadow');await totals(earned-80);assert.equal(await p.locator('#shop-meadow').textContent(),'적용 중');assert.equal(await p.locator('#shop-meadow').isDisabled(),true);
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-reading-v1')),reading);assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2')),qt);
  await nav('home');assert.equal(await p.locator('.home-decoration .scene-meadow').count(),1);
  await nav('customize');await category('accessory');await buy('ribbon');await totals(earned-125);
  await character('muni');assert.equal(await p.locator('#shop-ribbon').getAttribute('data-action'),'shop-buy');await buy('flower');
  await character('tas');await buy('sunglasses');await totals(earned-245);
  await nav('home');assert.equal(await p.locator('.home-decoration .friend-ko [data-accessory=ribbon]').count(),1);assert.equal(await p.locator('.home-decoration .friend-muni [data-accessory=flower]').count(),1);assert.equal(await p.locator('.home-decoration .friend-tas [data-accessory=sunglasses]').count(),1);assert.ok(await p.locator('.month-path .character-accessory').count()>3);
  await nav('customize');await category('frame');await buy('leaves');await totals(earned-300);assert.equal(await p.locator('.nav[data-page=account] .frame-leaves').count(),1);await buy('blossom');await totals(earned-385);assert.equal(await p.locator('.nav[data-page=account] .frame-blossom').count(),1);
  await p.reload();assert.equal(await p.evaluate(()=>page),'customize');await category('frame');await totals(earned-385);assert.equal(await p.locator('#shop-blossom').textContent(),'적용 중');
  await nav('account');await p.locator('#profile-name').fill('꾸민 이름');await p.locator('#account-form [type=submit]').tap();await nav('customize');await totals(earned-385);
  await p.locator('#shop-default').tap();await totals(earned-385);assert.equal(await p.locator('.nav[data-page=account] .frame-blossom').count(),0);await p.locator('#shop-blossom').tap();await totals(earned-385);
  await nav('activity');assert.equal(await p.locator('.activity-stats .card').nth(1).locator('h2').textContent(),`${earned}절`);assert.match(await p.locator('.activity-stats .card').nth(1).textContent(),/그동안 읽은 말씀/);
  await nav('customize');await category('background');await p.locator('[data-action=shop-preview][data-item=starlight]').tap();await totals(earned-385);
  await p.screenshot({path:'/tmp/quolingo-shop-mobile.png',fullPage:true});
  for(const width of [320,390,768,1440]){
   await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const tabs=await p.locator('.nav').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));assert.ok(tabs.every(tab=>tab.left>=0&&tab.right<=width&&tab.width>0));
  }
  await p.screenshot({path:'/tmp/quolingo-shop-desktop.png',fullPage:true});
  await p.goBack();await p.waitForFunction(()=>page==='activity');assert.equal(await p.locator('.nav[aria-current=page]').getAttribute('data-page'),'activity');
  // Cancelling earned reading reduces balance without deleting owned decorations.
  await p.evaluate(()=>{readingData={};accountStore.setItem(READING_KEY,'{}');render('customize');});await totals(0);assert.equal(await p.evaluate(()=>profile.decorations.owned.meadow),true);
  await p.reload();await totals(0);assert.equal(await p.locator('#shop-sunset').isDisabled(),true);
  // Previously purchased shared accessories become the replacement without another charge.
  await p.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('quolingo-profile-v1'));saved.decorations={owned:{ribbon:true,star:true},equipped:{ko:'star',muni:'ribbon',tas:'star'}};localStorage.setItem('quolingo-profile-v1',JSON.stringify(saved));});
  await p.reload();await nav('home');assert.equal(await p.locator('.home-decoration [data-accessory=sunglasses]').count(),2);
  assert.equal(await p.evaluate(()=>QuolingoDecor.spent(profile.decorations)),110);
  assert.deepEqual(errors,[]);console.log('PASS: existing QT/chapter diamonds, previews/cancel/storage rollback, single debits, independent character accessories and three frames, home application, saved profiles/reload, mobile navigation/layout, reading cancellation with retained ownership.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
