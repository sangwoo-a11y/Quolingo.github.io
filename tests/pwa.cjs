// Run under the same project subpath as GitHub Pages. Installation prompts are mocked;
// Chromium's real manifest, service worker, caches and offline navigation are exercised.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),prefix='/Quolingo.github.io/';
let cssSuffix='';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 const file=path.resolve(root,pathname.slice(prefix.length)||'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{
  if(error){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.setHeader('Cache-Control','no-store');
  res.end(path.basename(file)==='style.css'?body.toString()+cssSuffix:body);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}${prefix}`,profileDir=fs.mkdtempSync(path.join(os.tmpdir(),'quolingo-pwa-'));
 let context;
 try {
  context=await chromium.launchPersistentContext(profileDir,{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],viewport:{width:390,height:844},reducedMotion:'reduce'});
  const p=context.pages()[0],errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cdp=await context.newCDPSession(p),app=await cdp.send('Page.getAppManifest');
  assert.deepEqual(app.errors,[]);assert.equal(app.url,url+'manifest.webmanifest');
  const manifest=JSON.parse(app.data);assert.equal(new URL(manifest.scope,app.url).href,url);assert.equal(new URL(manifest.start_url,app.url).href,url);assert.equal(manifest.display,'standalone');
  assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,[]);
  for(const icon of manifest.icons){
   const size=await p.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return `${image.naturalWidth}x${image.naturalHeight}`;},new URL(icon.src,app.url).href);
   assert.equal(size,icon.sizes);
  }
  await p.locator('.nav[data-page=account]').click();
  await p.locator('#profile-name').fill('작성 중인 이름');
  const originalProfile=await p.evaluate(()=>localStorage.getItem('quolingo-profile-v1'));
  const originalReading=await p.evaluate(()=>localStorage.getItem('quolingo-reading-v1'));
  const changeSettings=async()=>{
   await p.locator('#qt-book').selectOption('matthew');await p.locator('#reading-book').selectOption('genesis');
   await p.locator('#daily-goal').fill('3');await p.locator('#completion-rule').selectOption('both');
   await p.locator('#skip-sunday-qt').check();await p.locator('input[name=avatar][value=tas]').check();
  };
  await changeSettings();
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-profile-v1')),originalProfile);
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-reading-v1')),originalReading);
  assert.equal(await p.evaluate(()=>profile.dailyGoal),1);
  const colors={apricot:'#f7b77f',sunshine:'#f4d778',sand:'#c6b3a2',sky:'#9dc9dc',rose:'#e2a3ad',lavender:'#b8aad6'};
  for(const [id,color] of Object.entries(colors)){
   await p.locator(`input[name=theme][value=${id}]`).check();
   assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),color);
   assert.equal(await p.locator('#profile-name').inputValue(),'작성 중인 이름');
   assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-profile-v1')),originalProfile);
   assert.equal(await p.locator('meta[name=theme-color]').getAttribute('content'),color);
   const themed=await cdp.send('Page.getAppManifest');assert.deepEqual(themed.errors,[]);
   const data=JSON.parse(themed.data);assert.equal(data.theme_color,color);
   for(const field of ['id','scope','start_url'])assert.equal(new URL(data[field],themed.url).href,new URL(manifest[field],app.url).href);
   assert.deepEqual(data.icons,manifest.icons);
   assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),`rgb(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(', ')})`);

  }
  await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,right:0,bottom:24,left:0}});
  assert.equal(await p.locator('.sidebar').evaluate(el=>getComputedStyle(el).height),'97px');
  assert.equal(await p.locator('.sidebar').evaluate(el=>getComputedStyle(el,'::after').height),'24px');
  assert.equal(await p.locator('.sidebar').evaluate(el=>getComputedStyle(el,'::after').backgroundColor),'rgb(184, 170, 214)');
  const menu=await p.locator('.sidebar').boundingBox();assert.equal(menu.y+menu.height,844);
  await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,right:0,bottom:0,left:0}});
  await p.locator('.nav[data-page=home]').click();assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'apricot');
  await p.locator('.nav[data-page=account]').click();assert.equal(await p.locator('input[name=theme][value=apricot]').isChecked(),true);
  assert.equal(await p.locator('#qt-book').inputValue(),'joshua');assert.equal(await p.locator('#reading-book').inputValue(),'joshua');
  assert.equal(await p.locator('#daily-goal').inputValue(),'1');assert.equal(await p.locator('#skip-sunday-qt').isChecked(),false);
  await changeSettings();
  await p.locator('input[name=theme][value=lavender]').check();
  await p.reload();await p.locator('.nav[data-page=account]').click();assert.equal(await p.locator('input[name=theme][value=apricot]').isChecked(),true);
  assert.equal(await p.locator('#profile-name').inputValue(),'');
  assert.equal(await p.locator('#qt-book').inputValue(),'joshua');assert.equal(await p.locator('#daily-goal').inputValue(),'1');
  await changeSettings();
  await p.locator('#profile-name').fill('저장한 이름');await p.locator('input[name=theme][value=lavender]').check();
  await p.locator('#account-form [type=submit]').click();
  await p.reload();await p.locator('.nav[data-page=account]').click();assert.equal(await p.locator('input[name=theme][value=lavender]').isChecked(),true);
  assert.equal(await p.locator('#profile-name').inputValue(),'저장한 이름');
  assert.equal(await p.locator('#qt-book').inputValue(),'matthew');assert.equal(await p.locator('#reading-book').inputValue(),'genesis');
  assert.equal(await p.locator('#daily-goal').inputValue(),'3');assert.equal(await p.locator('#completion-rule').inputValue(),'both');
  assert.equal(await p.locator('#skip-sunday-qt').isChecked(),true);assert.equal(await p.locator('input[name=avatar][value=tas]').isChecked(),true);
  assert.equal(await p.evaluate(()=>daySettings(today).dailyGoal),3);
  await p.locator('.nav[data-page=home]').click();
  const weekly=await p.locator('.path-week .day-node').evaluateAll(nodes=>[...new Set(nodes.map(n=>getComputedStyle(n).getPropertyValue('--week-color').trim()))]);
  assert.ok(weekly.length>=4);assert.equal(weekly[0],colors.lavender);
  await p.locator('.nav[data-page=account]').click();
  const offer=async outcome=>p.evaluate(outcome=>{
   const event=new Event('beforeinstallprompt',{cancelable:true});window.promptCalls=0;
   event.prompt=async()=>{window.promptCalls++;};event.userChoice=Promise.resolve({outcome});window.dispatchEvent(event);
  },outcome);
  await offer('dismissed');assert.equal(await p.locator('[data-action=install-app]').textContent(),'앱 설치');
  assert.equal(await p.evaluate(()=>window.promptCalls),0);
  await p.locator('[data-action=install-app]').click();assert.equal(await p.evaluate(()=>window.promptCalls),1);
  assert.match(await p.locator('.install-status').textContent(),/취소/);
  await p.locator('[data-action=install-app]').click();assert.equal(await p.locator('.install-help').getAttribute('open'),'');
  await offer('accepted');await p.locator('[data-action=install-app]').click();assert.match(await p.locator('.install-status').textContent(),/요청/);
  await p.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));assert.equal(await p.locator('[data-action=install-app]').isVisible(),false);
  assert.match(await p.locator('.install-status').textContent(),/설치했어요/);
  // Fetch fresh public assets even when an earlier copy is cached.
  cssSuffix='\n/* updated-css-from-network */';
  assert.match(await p.evaluate(()=>fetch('./style.css?v=new-version').then(r=>r.text())),/updated-css-from-network/);
  await p.goto(url+'?preview=1');await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.evaluate(()=>fetch('./private-example?token=never-cache'));
  const keys=await p.evaluate(async()=>{const names=await caches.keys();return (await Promise.all(names.map(async name=>(await (await caches.open(name)).keys()).map(r=>r.url)))).flat();});
  assert.ok(keys.length>=19);assert.ok(keys.every(key=>!new URL(key).search&&!key.includes('private-example')));
  await context.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('.nav[data-page=home]').click();await p.locator('.day-node:not([disabled])').first().click();
  await p.locator('#passage-selection [type=submit]').click();assert.ok(await p.locator('.verse-row').count()>0);
  assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'lavender');
  assert.ok(keys.some(key=>key.endsWith('/bible-data/nkrv.json')));assert.ok(keys.some(key=>key.endsWith('/bible-data/rnksv.json')));
  for(const version of ['nkrv','rnksv']){
   await p.locator('.nav[data-page=account]').click();await p.locator('#bible-version').selectOption(version);await p.locator('#account-form [type=submit]').click();
   await p.locator('.nav[data-page=home]').click();await p.locator('.day-node:not([disabled])').first().click();await p.locator('#passage-selection [type=submit]').click();await p.locator('.verse-row').first().waitFor();
   assert.equal(await p.evaluate(()=>profile.bibleVersion),version);assert.equal(await p.locator('.official-bible-link').count(),0);
   assert.ok(await p.locator('.verse-row').count()>0);
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await context.setOffline(false);assert.deepEqual(errors,[]);
  console.log('PASS: real Chrome installability, project-scoped manifest/icons/service worker, color previews without writes, unsaved navigation/reload reset, profile-save persistence, distinct weekly colors, install/cancel/fallback/installed states, fresh network assets, public-only caches and offline navigation and local KRV/NKRV/RNKSV reading.');
 }finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(profileDir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
