// Touch/browser history, chapter toggles, confirmed QT steps and combined diamonds.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});await p.goto(url);
  const nav=value=>p.locator(`.nav[data-page="${value}"]`).tap();
  const mode=value=>p.locator(`[data-mode="${value}"]`).tap();
  const openDay=()=>p.locator('.day-node[data-date="2026-10-20"]').tap();
  const state=()=>p.evaluate(()=>({page,stage,selected,mode}));
  const back=async expected=>{await p.goBack();await p.waitForFunction(expected=>page===expected,expected);};
  const next=()=>p.locator('#next').tap();
  const total=async expected=>{
   assert.deepEqual(await p.locator('[data-stat=total]').allTextContents(),[String(expected),String(expected)]);
  };
  await mode('reading');await openDay();
  await p.locator('#word-chapter').selectOption('joshua-6');await p.locator('#word-selection [type=submit]').tap();
  assert.equal(await p.locator('.chapter-title').textContent(),'여호수아 6장');
  assert.equal(await p.locator('.back').count(),0);
  assert.equal(await p.locator('[data-action=previous-chapter]').isDisabled(),false);
  assert.equal(await p.locator('[data-action=next-chapter]').isDisabled(),false);
  await p.locator('.chapter-title').tap();assert.equal((await state()).page,'wordSelection');
  await back('reader');assert.equal((await state()).selected,'joshua-6');
  await p.locator('[data-action=next-chapter]').tap();assert.equal((await state()).selected,'joshua-7');
  await total(0); // Navigation never marks a chapter read.
  await p.locator('[data-action=previous-chapter]').tap();assert.equal((await state()).selected,'joshua-6');
  const count=await p.locator('.verse-row').count();assert.equal(count,27);
  const toggle=p.locator('[data-action=read-chapter]');
  const historyLength=await p.evaluate(()=>history.length);
  await toggle.tap();assert.equal(await toggle.getAttribute('aria-pressed'),'true');await total(27);
  await toggle.tap();assert.equal(await toggle.getAttribute('aria-pressed'),'false');await total(0);
  await toggle.tap();await total(27);assert.equal(await p.evaluate(()=>history.length),historyLength);
  await p.reload();assert.equal((await state()).page,'reader');assert.equal((await state()).selected,'joshua-6');await total(27);
  await p.locator('.mobile-stats .stat-button').tap();assert.equal((await state()).page,'activity');
  assert.equal(await p.locator('.calendar-detail [data-action=unread-chapter]').count(),0);
  assert.match(await p.locator('.activity-stats .card').nth(1).textContent(),/27절/);
  assert.doesNotMatch(await p.locator('#content').textContent(),/하루 완료/);
  await back('reader');assert.equal((await state()).selected,'joshua-6');
  await p.goForward();await p.waitForFunction(()=>page==='activity');await back('reader');
  // Choosing another chapter replaces selection state; back restores that chosen chapter.
  await p.locator('.chapter-title').tap();await p.locator('#word-chapter').selectOption('joshua-1');
  await p.locator('#word-selection [type=submit]').tap();assert.equal(await p.locator('[data-action=previous-chapter]').isDisabled(),true);
  await back('wordSelection');assert.equal(await p.locator('#word-chapter').inputValue(),'joshua-1');
  await p.locator('#word-chapter').selectOption('joshua-24');await p.locator('#word-selection [type=submit]').tap();
  assert.equal(await p.locator('[data-action=next-chapter]').isDisabled(),true);await total(27);
  // Each confirmed QT stage adds one quarter, regardless of selected chapter length.
  await nav('home');await mode('qt');await openDay();
  await p.locator('#chapter-select').selectOption('joshua-6');await p.locator('#end-verse').selectOption('2');
  await p.locator('#passage-selection [type=submit]').tap();
  assert.equal(await p.locator('.back').count(),0);
  assert.equal(await p.locator('[data-action=previous]').isVisible(),true);
  await p.locator('[data-action=previous]').tap();assert.equal((await state()).page,'selection');
  await p.locator('#passage-selection [type=submit]').tap();await next();await total(29);
  assert.equal(await p.evaluate(()=>dayQTPercent(today)),25);
  await nav('home');assert.equal(await p.locator('.day-node[data-date="2026-10-20"]').evaluate(e=>e.style.getPropertyValue('--fill')),'25%');
  await openDay();await p.locator('#passage-selection [type=submit]').tap();await next();
  await p.locator('#reflection').fill('모바일 관찰 초안');assert.equal(await p.evaluate(()=>dayQTPercent(today)),25);
  await p.goBack();await p.waitForFunction(()=>page==='editor'&&stage===0);
  await p.goForward();await p.waitForFunction(()=>page==='editor'&&stage===1);
  assert.equal(await p.locator('#reflection').inputValue(),'모바일 관찰 초안');
  await next();assert.equal((await state()).stage,2);assert.equal(await p.evaluate(()=>dayQTPercent(today)),50);
  assert.equal(await p.locator('.reading-excerpt[open]').count(),0);
  await p.locator('#reflection').fill('모바일 해석');await next();assert.equal(await p.evaluate(()=>dayQTPercent(today)),75);
  assert.equal(await p.locator('.reading-excerpt[open]').count(),0);
  await p.locator('#reflection').fill('모바일 적용');assert.equal(await p.evaluate(()=>dayQTPercent(today)),75);
  await next();assert.equal((await state()).page,'success');assert.equal(await p.evaluate(()=>dayQTPercent(today)),100);
  await total(29);await p.locator('.success [data-page=home]').tap();
  assert.equal(await p.locator('.day-node[data-date="2026-10-20"]').evaluate(e=>e.style.getPropertyValue('--fill')),'100%');
  await mode('reading');await openDay();await p.locator('#word-chapter').selectOption('joshua-6');await p.locator('#word-selection [type=submit]').tap();
  await toggle.tap();await total(2); // Cancelling chapter reading retains the two QT verses.
  await p.locator('.mobile-stats .stat-button').tap();
  assert.match(await p.locator('.activity-stats .card').nth(1).textContent(),/2절/);
  await nav('home');await p.locator('.mobile-logo').tap();assert.equal((await state()).page,'home');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: touch chapter title/reselection, free previous/next boundaries, completion toggle and persistence, mobile diamond totals/link, browser back/forward and draft restoration, confirmed QT quarter progress, additive QT/reading verses and independent cancellation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
