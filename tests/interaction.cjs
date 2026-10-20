// Browser checks for independent preferences, real press feedback and weekly geometry.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.clock.install({time:new Date('2026-10-20T03:00:00Z')});await p.goto(url);
  const home=()=>p.locator('.nav[data-page=home]').click();
  const account=()=>p.locator('.nav[data-page=account]').click();
  assert.equal(await p.locator('.sidebar-friend .friend-character').count(),3);
  const today=p.locator('.day-node[data-date="2026-10-20"]');
  await today.scrollIntoViewIfNeeded();
  const face=today.locator('.node-core'),before=await face.boundingBox(),button=await today.boundingBox();
  await p.mouse.move(button.x+button.width/2,button.y+button.height/2);await p.waitForTimeout(160);
  const hovered=await face.boundingBox();assert.ok(hovered.y-before.y>1&&hovered.y-before.y<3,'hover slightly depresses the face');
  await p.mouse.down();await p.waitForTimeout(160);
  const pressed=await face.boundingBox();assert.ok(pressed.y-hovered.y>1&&pressed.y-before.y<5,'press is deeper than hover but stays shallow');
  assert.match(await face.evaluate(el=>getComputedStyle(el).filter),/brightness\(1\.2\)/);
  await p.screenshot({path:'/tmp/quolingo-pressed-button.png'});
  await p.mouse.up();assert.equal(await today.getAttribute('class').then(value=>value.includes('is-opening')),true);
  assert.equal(await face.evaluate(el=>getComputedStyle(el,'::after').animationName),'button-shine');
  await p.clock.runFor(280);await p.locator('#chapter-select').waitFor();
  // Leaving the page during feedback must cancel its pending navigation.
  await home();await today.dispatchEvent('click');await account();await p.clock.runFor(300);
  assert.equal(await p.locator('#qt-book').isVisible(),true);
  await home();await today.focus();await p.keyboard.press('Enter');await p.clock.runFor(280);await p.locator('#chapter-select').waitFor();
  // Companions sit at each week's midpoint, with occasional pairs and alternating sides.
  for(const [date,count] of [['2027-02-20',4],['2026-03-20',6],['2026-10-20',5]]){
   await p.clock.setSystemTime(new Date(date+'T03:00:00Z'));await p.reload();
   assert.equal(await p.locator('.path-week').count(),count);
   for(const width of [320,390,768,1024,1440]){
    await p.setViewportSize({width,height:1000});await p.evaluate(()=>new Promise(requestAnimationFrame));
    const geometry=await p.locator('.path-week').evaluateAll(weeks=>weeks.map(week=>{
     const companion=week.querySelector('.week-companion'),stops=[...week.querySelectorAll('.chapter-stop')],button=companion.parentElement.querySelector('.day-node');
     const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
     const path=box(week.closest('.month-path'));
     return {path,anchor:stops.indexOf(companion.parentElement),days:stops.length,side:companion.dataset.side,character:companion.dataset.character,count:companion.querySelectorAll('.friend-character').length,friend:box(companion),button:box(button),others:[...week.querySelectorAll('.day-node')].map(box)};
    }));
    for(const [i,week] of geometry.entries()){
     assert.ok(Math.abs(week.anchor-Math.floor((week.days-1)/2))<=1);assert.equal(week.count,i%3===1?2:1);assert.equal(week.character,['ko','muni','tas'][i%3]);
     const left=week.button.left-week.path.left,right=week.path.right-week.button.right;
     if(Math.abs(left-right)>1)assert.equal(week.side,left>right?'left':'right');
     assert.ok(week.side==='right'?week.friend.left>week.button.right:week.friend.right<week.button.left);
     assert.ok(week.friend.left>=week.path.left&&week.friend.right<=week.path.right,'companion remains in the open space beside the path');
     for(const button of week.others)assert.ok(!(week.friend.left<button.right&&week.friend.right>button.left&&week.friend.top<button.bottom&&week.friend.bottom>button.top),'companion does not overlap a date button');
    }
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
  }
  // Preserve the old common book as both initial choices, then save them independently.
  await p.evaluate(()=>localStorage.setItem('quolingo-profile-v1',JSON.stringify({name:'기존 이름',bookId:'john'})));await p.reload();await account();
  assert.equal(await p.locator('#qt-book').inputValue(),'john');assert.equal(await p.locator('#reading-book').inputValue(),'john');
  await p.locator('#qt-book').selectOption('leviticus');assert.equal(await p.locator('#reading-book').inputValue(),'john');
  await p.locator('#reading-book').selectOption('romans');assert.equal(await p.locator('#qt-book').inputValue(),'leviticus');
  await p.reload();await account();assert.equal(await p.locator('#qt-book').inputValue(),'leviticus');assert.equal(await p.locator('#reading-book').inputValue(),'romans');assert.equal(await p.locator('#profile-name').inputValue(),'기존 이름');
  await home();assert.match(await p.locator('.unit small').textContent(),/레위기/);await p.locator('[data-mode=reading]').click();assert.match(await p.locator('.unit small').textContent(),/로마서/);
  await p.emulateMedia({reducedMotion:'reduce'});await today.click();await p.locator('#word-chapter').waitFor();
  assert.ok((await p.locator('#word-chapter option').allTextContents()).every(text=>text.startsWith('로마서')));
  assert.deepEqual(errors,[]);
  console.log('PASS: visible depth/shine/press, keyboard activation, cancelled navigation, 4/5/6-week calendars, midweek solo and paired companions in the more spacious side without collisions at 320–1440px, migrated independent book settings and reduced-motion routing.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
