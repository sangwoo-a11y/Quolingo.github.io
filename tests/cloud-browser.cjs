// Auth/database are mocked locally. No real sign-in, journals or messages leave this test.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});
  await p.route('**/supabase-config.js*',route=>route.fulfill({contentType:'text/javascript',body:"window.QUOLINGO_SUPABASE={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};"}));
  await p.route('**/vendor/supabase-2.118.0.js',route=>route.fulfill({contentType:'text/javascript',body:`
   window.mockUser=JSON.parse(localStorage.getItem('mock-user')||'null');window.mockListener=()=>{};window.mockOffline=false;
   const database=()=>JSON.parse(localStorage.getItem('mock-database')||'{}');
   window.mockSignIn=id=>{window.mockUser={id,email:id.slice(0,1)+'@example.test'};localStorage.setItem('mock-user',JSON.stringify(window.mockUser));window.mockListener('SIGNED_IN',{user:window.mockUser});};
   window.supabase={createClient:()=>({
    auth:{onAuthStateChange:fn=>{window.mockListener=fn;},getSession:async()=>({data:{session:window.mockUser?{user:window.mockUser}:null}}),
     signInWithOAuth:async options=>{window.oauthOptions=options;return {};},signOut:async()=>{window.mockUser=null;localStorage.removeItem('mock-user');window.mockListener('SIGNED_OUT',null);return {};}},
    from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>window.mockOffline?{error:{message:'offline'}}:{data:database()[window.mockUser.id]||null}})}),
    rpc:async(_name,{p_user_id,p_expected_revision,p_payload})=>{if(window.mockOffline)return {error:{message:'offline'}};if(p_user_id!==window.mockUser.id)return {error:{message:'Account changed'}};const rows=database(),old=rows[window.mockUser.id];if((old?.revision||0)!==p_expected_revision)return {data:{saved:false}};const revision=p_expected_revision+1;rows[window.mockUser.id]={payload:p_payload,revision};localStorage.setItem('mock-database',JSON.stringify(rows));return {data:{saved:true,revision}};}
   })};` }));
  await p.goto(url);await p.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'기기 프로필'}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({'2026-10-20':{'joshua-1':{read:[1],sessions:{'1-1':{start:1,end:1,read:[1],observation:'GUEST_NOTE',interpretation:'guest meaning',application:'guest action',completed:true}}}}}));
  });await p.reload();
  const nav=page=>p.locator('.nav[data-page="'+page+'"]').click();
  const signed=async id=>{await p.evaluate(id=>window.mockSignIn(id),id);await p.waitForFunction(id=>accountStore.owner===id,id);await p.waitForFunction(()=>['synced','error','conflict'].includes(cloudAccount.status));};
  await nav('account');await p.locator('[data-action=cloud-login]').click();
  assert.equal(await p.evaluate(()=>window.oauthOptions.provider),'google');
  assert.equal(await p.evaluate(()=>window.oauthOptions.options.redirectTo),url+'/');
  await p.evaluate(id=>{const rows=JSON.parse(localStorage.getItem('mock-database')||'{}');rows[id]={revision:1,payload:{profile:{name:'계정 프로필'},chapters:{'2026-10-20':{'joshua-1':{read:[1],sessions:{'1-1':{start:1,end:1,read:[1],observation:'ACCOUNT_NOTE',interpretation:'account meaning',application:'account action',completed:true}}}}}}};localStorage.setItem('mock-database',JSON.stringify(rows));},A);
  await signed(A);await nav('journal');assert.doesNotMatch(await p.locator('#content').textContent(),/GUEST_NOTE/);assert.match(await p.locator('#content').textContent(),/ACCOUNT_NOTE/);
  assert.equal(await p.locator('h1').textContent(),'나의 묵종');assert.equal(await p.locator('[data-action=export]').count(),0);
  await nav('account');assert.equal(await p.locator('#profile-name').inputValue(),'계정 프로필');
  assert.equal(await p.locator('[data-action=cloud-import],[data-action=cloud-sync],[data-action=export]').count(),0);
  assert.equal(await p.locator('label[for=qt-book]').textContent(),'QT');
  await nav('journal');
  // An account edit is saved in its own cache and uploaded automatically.
  await p.locator('[data-chapter="joshua-1"]').click();await p.locator('#next').click();
  await p.locator('#reflection').fill('ACCOUNT_A_NOTE');await p.clock.runFor(1000);await p.waitForFunction(()=>cloudAccount.status==='synced');
  assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('mock-database'))[id].payload.chapters['2026-10-20']['joshua-1'].sessions['1-1'].observation,A),'ACCOUNT_A_NOTE');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('quolingo-chapters-v2'))['2026-10-20']['joshua-1'].sessions['1-1'].observation),'GUEST_NOTE');
  // The same note edited elsewhere is compared, never silently overwritten.
  await p.evaluate(id=>{window.mockOffline=true;const rows=JSON.parse(localStorage.getItem('mock-database'));rows[id].revision++;rows[id].payload.chapters['2026-10-20']['joshua-1'].sessions['1-1'].observation='REMOTE_NOTE';localStorage.setItem('mock-database',JSON.stringify(rows));},A);
  await p.locator('#reflection').fill('LOCAL_NOTE');await p.evaluate(()=>{window.mockOffline=false;window.dispatchEvent(new Event('online'));});await p.waitForFunction(()=>cloudAccount.status==='conflict');await nav('account');
  assert.equal(await p.locator('.sync-conflicts').isVisible(),true);assert.match(await p.locator('.sync-conflicts textarea').first().inputValue(),/LOCAL_NOTE/);
  await p.locator('[data-action=cloud-local]').click();await p.waitForFunction(()=>cloudAccount.status==='synced');
  assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('mock-database'))[id].payload.chapters['2026-10-20']['joshua-1'].sessions['1-1'].observation,A),'LOCAL_NOTE');
  await p.screenshot({path:'/tmp/quolingo-cloud-account-mobile.png',fullPage:true});
  await p.locator('[data-action=cloud-logout]').click();await p.waitForFunction(()=>accountStore.owner===null);
  await nav('journal');assert.match(await p.locator('#content').textContent(),/GUEST_NOTE/);assert.doesNotMatch(await p.locator('#content').textContent(),/LOCAL_NOTE/);
  await p.evaluate(id=>{const rows=JSON.parse(localStorage.getItem('mock-database'));rows[id]={revision:1,payload:{profile:{name:'B 프로필',qtBookId:'matthew'},chapters:{'2026-10-20':{'matthew-1':{read:[1],sessions:{'1-1':{start:1,end:1,read:[1],observation:'B_PRIVATE_NOTE',interpretation:'B meaning',application:'B action',completed:true}}}}}}};localStorage.setItem('mock-database',JSON.stringify(rows));},B);
  await signed(B);await nav('journal');assert.doesNotMatch(await p.locator('#content').textContent(),/LOCAL_NOTE|GUEST_NOTE/);assert.match(await p.locator('#content').textContent(),/B_PRIVATE_NOTE/);
  await nav('account');await p.locator('[data-action=cloud-logout]').click();await p.waitForFunction(()=>accountStore.owner===null);
  await signed(A);await nav('journal');assert.match(await p.locator('#content').textContent(),/LOCAL_NOTE/);
  await p.reload();await nav('journal');assert.match(await p.locator('#content').textContent(),/LOCAL_NOTE/);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS: Google OAuth options, hidden manual controls and automatic sync, per-account records and profile, automatic upload, conflict comparison/resolution, logout isolation, second account, reload and mobile UI without external auth requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
