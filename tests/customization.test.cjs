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
test('accessory ownership and equipment are independent for each character',()=>{
 const ko=D.purchase({},'ribbon',300,'ko').value;
 assert.equal(D.owns(ko,'ribbon','ko'),true);assert.equal(D.owns(ko,'ribbon','muni'),false);assert.equal(D.equip(ko,'muni','ribbon'),null);
 const muni=D.purchase(ko,'flower',300,'muni').value;
 const tas=D.purchase(muni,'sunglasses',300,'tas').value;
 assert.equal(D.spent(tas),165);assert.equal(tas.equipped.ko,'ribbon');assert.equal(tas.equipped.muni,'flower');assert.equal(tas.equipped.tas,'sunglasses');
 assert.equal(D.purchase(tas,'ribbon',300,'ko').reason,'owned');
 const another=D.purchase(tas,'ribbon',300,'muni').value;assert.equal(D.spent(another),210);assert.equal(another.equipped.ko,'ribbon');
 const removed=D.equip(tas,'ko','');assert.equal(D.owns(removed,'ribbon','ko'),true);assert.equal(D.spent(removed),165);
 const preview=D.preview(tas,'background','starlight');assert.equal(preview.equipped.background,'starlight');assert.equal(tas.equipped.background,'');assert.equal(D.spent(preview),165);assert.equal(D.normalize(preview).equipped.background,'');
});
test('old shared purchases and renamed star badges keep their original value and ownership',()=>{
 const previous={owned:{ribbon:true,star:true},equipped:{ko:'star',muni:'ribbon',tas:'star'}};
 const migrated=D.normalize(previous);assert.equal(D.spent(migrated),110);assert.equal(migrated.equipped.ko,'sunglasses');assert.equal(migrated.equipped.tas,'sunglasses');
 for(const character of ['muni','ko','tas'])assert.equal(D.owns(migrated,'sunglasses',character),true);
 assert.equal(D.purchase(migrated,'sunglasses',999,'muni').reason,'owned');
 assert.deepEqual(D.normalize(migrated),migrated);
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

test('cloud merge keeps separately purchased character accessories',()=>{
 const base={profile:{decorations:D.normalize()}};
 const local={profile:{decorations:D.purchase({},'ribbon',200,'ko').value}};
 const remote={profile:{decorations:D.purchase({},'ribbon',200,'muni').value}};
 const result=Cloud.merge(base,local,remote);assert.equal(result.conflicts.length,0);assert.equal(D.spent(result.value.profile.decorations),90);
 assert.equal(D.owns(result.value.profile.decorations,'ribbon','ko'),true);assert.equal(D.owns(result.value.profile.decorations,'ribbon','muni'),true);assert.equal(D.owns(result.value.profile.decorations,'ribbon','tas'),false);
});
