const test = require('node:test');
const assert = require('node:assert/strict');
const {settings,state,streak} = require('../progress.js');
const tue='2026-10-20', sun='2026-10-18';
function config(completionRule,skipSundayQt=false){return {dailyGoal:2,completionRule,skipSundayQt};}
function shift(key,n){const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);}

test('goals require valid whole chapters and old profiles keep QT completion',()=>{
  assert.deepEqual(settings({}),{dailyGoal:1,completionRule:'qt',skipSundayQt:false});
  for(const dailyGoal of [0,-1,1.5,1190,NaN])assert.equal(settings({dailyGoal}).dailyGoal,1);
  assert.equal(settings({dailyGoal:1189}).dailyGoal,1189);
});
test('all four completion conditions keep QT and chapter totals separate',()=>{
  for(const qt of [false,true])for(const count of [0,1,2,3]){
    const read=count>=2;
    assert.equal(state(tue,qt,count,config('both')).complete,qt&&read);
    assert.equal(state(tue,qt,count,config('either')).complete,qt||read);
    assert.equal(state(tue,qt,count,config('qt')).complete,qt);
    assert.equal(state(tue,qt,count,config('reading')).complete,read);
  }
});
test('Sunday exemption never awards an automatic completed day',()=>{
  for(const rule of ['both','either','reading']){
    assert.equal(state(sun,false,0,config(rule,true)).complete,false);
    assert.equal(state(sun,false,2,config(rule,true)).complete,true);
    assert.equal(state(sun,true,0,config(rule,true)).complete,false);
  }
  assert.deepEqual(state(sun,true,2,config('qt',true)),{complete:false,rest:true,qtOff:true,readingDone:true});
  assert.equal(state(tue,false,2,config('both',true)).complete,false);
});
test('streak bridges a Sunday rest without adding it and still breaks on a missed required day',()=>{
  const completed=new Set(['2026-10-16','2026-10-17','2026-10-19']);
  const status=date=>state(date,completed.has(date),0,config('qt',true));
  assert.equal(streak('2026-10-20',status,shift),3);
  assert.equal(streak('2026-10-18',status,shift),2);
  completed.delete('2026-10-17');
  assert.equal(streak('2026-10-20',status,shift),1);
});
