// Mock the OS share sheet and clipboard: these checks never send a message.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});
  await p.addInitScript(()=>{
   window.shared=[];window.copied=[];
   Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{if(window.shareError)throw new DOMException('test error',window.shareError);window.shared.push(payload);}});
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.copyError)throw new DOMException('test denied','NotAllowedError');window.copied.push(text);}}});
  });
  await p.goto(url);
  await p.evaluate(()=>{
   localStorage.setItem('quolingo-profile-v1',JSON.stringify({qtBookId:'matthew',readingBookId:'genesis'}));
   localStorage.setItem('quolingo-chapters-v2',JSON.stringify({
    '2026-10-20':{'matthew-5':{read:[3,4,5],sessions:{
     '3-4':{start:3,end:4,read:[3,4],observation:'나의 관찰\n<img src=x onerror="window.injected=true">',interpretation:'나의 해석',application:'PRIVATE_APPLICATION',completed:true},
     '5-5':{start:5,end:5,read:[5],observation:'미완료 내용',completed:false}
    }}},
    '2026-10-19':{'joshua-1':{read:[1],sessions:{'1-1':{start:1,end:1,read:[1],observation:'지난 관찰',interpretation:'지난 해석',application:'OLD_PRIVATE',completed:true}}}}
   }));
  });await p.reload();
  const original=await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2'));
  await p.locator('.nav[data-page=journal]').click();
  assert.equal(await p.locator('[data-action=share-entry]').count(),2);
  const share=p.locator('[data-action=share-entry][data-date="2026-10-20"]');
  await share.click();const dialog=p.locator('#share-dialog'),preview=p.locator('#share-preview'),apply=p.locator('#share-application');
  assert.equal(await dialog.isVisible(),true);assert.equal(await apply.isChecked(),false);
  const without=await preview.inputValue();assert.ok(without.startsWith('날짜: 2026-10-20'));
  assert.match(without,/마태복음 5:3–4/);assert.match(without,/심령이 가난한/);
  assert.ok(without.indexOf('관찰\n')<without.indexOf('해석\n'));assert.ok(!without.includes('PRIVATE_APPLICATION'));assert.ok(!without.includes('미완료 내용'));
  assert.equal(await p.evaluate(()=>window.injected),undefined);assert.equal(await p.evaluate(()=>window.shared.length),0);
  await p.locator('[data-action=send-share]').click();assert.equal(await p.evaluate(()=>window.shared[0].text),without);
  assert.equal(await p.evaluate(()=>Object.hasOwn(window.shared[0],'url')),false);
  await apply.check();const withApplication=await preview.inputValue();assert.ok(withApplication.endsWith('적용\nPRIVATE_APPLICATION'));
  await p.locator('[data-action=send-share]').click();assert.equal(await p.evaluate(()=>window.shared[1].text),withApplication);
  await apply.uncheck();await p.locator('[data-action=copy-share]').click();assert.equal(await p.evaluate(()=>window.copied[0]),without);
  await p.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await preview.inputValue(),'');
  assert.equal(await share.evaluate(el=>document.activeElement===el),true);
  await share.click();assert.equal(await apply.isChecked(),false);
  // Cancelling the OS chooser never silently copies or retries.
  await p.evaluate(()=>window.shareError='AbortError');await p.locator('[data-action=send-share]').click();
  assert.match(await p.locator('#share-feedback').textContent(),/취소/);assert.equal(await p.evaluate(()=>window.copied.length),1);assert.equal(await dialog.isVisible(),true);
  await p.evaluate(()=>window.shareError='NotAllowedError');await p.locator('[data-action=send-share]').click();assert.match(await p.locator('#share-feedback').textContent(),/복사/);
  await p.evaluate(()=>window.copyError=true);await p.locator('[data-action=copy-share]').click();
  assert.match(await p.locator('#share-feedback').textContent(),/직접 복사/);
  assert.equal(await preview.evaluate(el=>el.selectionEnd-el.selectionStart),without.length);
  await p.locator('[data-action=close-share]').click();
  // Without native sharing, copying keeps the selected record's date and excludes application.
  await p.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});window.copyError=false;});
  await p.locator('[data-action=share-entry][data-date="2026-10-19"]').click();
  assert.equal(await p.locator('[data-action=send-share]').textContent(),'내용 복사하기');assert.equal(await p.locator('[data-action=copy-share]').isVisible(),false);
  await p.locator('[data-action=send-share]').click();
  const old=await p.evaluate(()=>window.copied.at(-1));assert.ok(old.startsWith('날짜: 2026-10-19'));assert.match(old,/여호수아 1:1/);assert.ok(!old.includes('OLD_PRIVATE'));
  await p.setViewportSize({width:390,height:844});const box=await dialog.boundingBox();assert.ok(box.x>=10&&box.x+box.width<=380);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:'/tmp/quolingo-share-mobile.png'});
  await p.locator('[data-action=close-share]').click();await p.setViewportSize({width:1440,height:1000});await share.click();
  await apply.check();await p.screenshot({path:'/tmp/quolingo-share-desktop.png'});
  assert.equal(await p.evaluate(()=>localStorage.getItem('quolingo-chapters-v2')),original);
  assert.deepEqual(errors,[]);
  console.log('PASS: completed-only sharing, native payload order/range/date, explicit application opt-in/reset, safe literal text, cancel/error handling, clipboard and manual fallback, historical records, mobile dialog and unchanged saved QT.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
