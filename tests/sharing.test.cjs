const test=require('node:test');
const assert=require('node:assert/strict');
const {text}=require('../sharing.js');
const entry={date:'2026-10-20',reference:'여호수아 1:1–2',verses:[{number:1,text:'첫째 절'},{number:2,text:'둘째 절'}],observation:'관찰 첫 줄\n둘째 줄 <문자>',interpretation:'내 해석',application:'PRIVATE_APPLY'};
test('sharing keeps date/reference/reflections but excludes Bible text and application by default',()=>{
 assert.equal(text(entry),'날짜: 2026-10-20\n\n말씀: 여호수아 1:1–2\n\n관찰\n관찰 첫 줄\n둘째 줄 <문자>\n\n해석\n내 해석');
 assert.ok(!text(entry).includes('PRIVATE_APPLY'));
 assert.ok(!text(entry).includes('첫째 절'));assert.ok(!text(entry).includes('둘째 절'));
 assert.equal(entry.application,'PRIVATE_APPLY');
});
test('application is appended only on explicit opt-in and old records keep their own dates',()=>{
 assert.ok(text(entry,true).endsWith('\n\n적용\nPRIVATE_APPLY'));
 assert.ok(!text(entry,'true').includes('PRIVATE_APPLY'));
 assert.ok(text({...entry,date:'2026-10-19'}).startsWith('날짜: 2026-10-19'));
});
