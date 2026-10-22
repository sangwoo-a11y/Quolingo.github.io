const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../customization.js'),Cloud=require('../cloud.js');
test('catalog ownership determines spend; unknown or unequipped saved items cannot grant ownership',()=>{
 const value=D.normalize({owned:{ribbon:true,free:true,star:false},equipped:{ko:'ribbon',tas:'star',background:'ribbon'}});
 assert.deepEqual(value.owned,{ribbon:true});assert.equal(value.equipped.ko,'ribbon');assert.equal(value.equipped.tas,'');assert.equal(value.equipped.background,'');assert.equal(D.spent(value),45);assert.equal(D.balance(100,value),55);
});
test('purchases require enough earned verses and atomically unlock/equip exactly once',()=>{
 const initial=D.normalize();assert.equal(D.purchase(initial,'meadow',79,'background').reason,'balance');
 assert.equal(D.purchase(initial,'meadow',100,'ko').reason,'invalid');
 const bought=D.purchase(initial,'meadow',80,'background');assert.equal(bought.ok,true);assert.equal(bought.value.equipped.background,'meadow');assert.equal(D.balance(80,bought.value),0);
 assert.equal(D.purchase(bought.value,'meadow',999,'background').reason,'owned');assert.deepEqual(initial,D.normalize());
});
test('one accessory can dress all friends without charging again; preview is temporary',()=>{
 const purchased=D.purchase({},'ribbon',100,'ko').value;
 let equipped=D.equip(purchased,'muni','ribbon');equipped=D.equip(equipped,'tas','ribbon');assert.equal(D.spent(equipped),45);
 equipped=D.equip(equipped,'ko','');assert.equal(equipped.owned.ribbon,true);assert.equal(D.balance(100,equipped),55);
 assert.equal(D.equip(equipped,'background','starlight'),null);
 const preview=D.preview(equipped,'background','starlight');assert.equal(preview.equipped.background,'starlight');assert.equal(equipped.equipped.background,'');assert.equal(D.spent(preview),45);assert.equal(D.normalize(preview).equipped.background,'');
});
test('undoing reading never refunds a purchase or permits repeat rewards',()=>{
 const state=D.purchase({},'meadow',90,'background').value;
 assert.equal(D.balance(20,state),0);assert.equal(D.balance(90,state),10);assert.equal(D.balance(110,state),30);
 assert.equal(D.normalize(state).owned.meadow,true);
});
test('cloud merge retains independent purchases and counts a shared unlock only once',()=>{
 const state={decorations:D.normalize()},base={profile:state};
 const local={profile:{decorations:D.purchase(state.decorations,'ribbon',200,'ko').value}};
 const remote={profile:{decorations:D.purchase(state.decorations,'meadow',200,'background').value}};
 const merged=Cloud.merge(base,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(D.spent(merged.value.profile.decorations),125);
 assert.equal(merged.value.profile.decorations.equipped.ko,'ribbon');assert.equal(merged.value.profile.decorations.equipped.background,'meadow');
 const same=Cloud.merge(base,local,local);assert.equal(D.spent(same.value.profile.decorations),45);
});
