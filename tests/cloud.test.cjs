const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../cloud.js');
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
class Memory {
 constructor(){this.values=new Map();this.fail=false;}
 getItem(k){return this.values.get(k)||null;}
 setItem(k,v){if(this.fail)throw new Error('full');this.values.set(k,v);}
}
function remoteClient(user={id:A,email:'a@example.test'}){
 let row=null,revision=0,fail=false,listener=()=>{},reads=0;
 const client={auth:{onAuthStateChange(fn){listener=fn;},async getSession(){return {data:{session:user?{user}:null}};},async signOut(){user=null;listener('SIGNED_OUT',null);return {};},async signInWithOAuth(value){client.oauth=value;return {};}},
  from(){return {select(){return {eq(){return this;},async maybeSingle(){reads++;if(fail)return {error:new Error('offline')};return {data:row?{payload:structuredClone(row),revision}:null};}};}};},
  async rpc(_name,{p_user_id,p_expected_revision,p_payload}){if(fail)return {error:new Error('offline')};if(p_user_id!==user?.id)return {error:new Error('Account changed')};if(p_expected_revision!==revision)return {data:{saved:false}};row=structuredClone(p_payload);revision++;return {data:{saved:true,revision}};},
  set(value){row=structuredClone(value);revision++;},get row(){return row;},get revision(){return revision;},get reads(){return reads;},set fail(value){fail=value;}};
 return client;
}
const account=(client,store,extra={})=>new Q.Account({client,store,delay:60000,...extra});
test('public configuration accepts publishable/anon keys and rejects privileged keys',()=>{
 const url='https://example.supabase.co';
 assert.equal(Q.config({url,publishableKey:'sb_publishable_test'}).url,url);
 const jwt=role=>'e30.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert.ok(Q.config({url,publishableKey:jwt('anon')}));
 for(const publishableKey of ['sb_secret_test',jwt('service_role'),''])assert.equal(Q.config({url,publishableKey}),null);
 for(const url of ['http://example.test','https://me:pass@example.test','https://example.test/path'])assert.equal(Q.config({url,publishableKey:'sb_publishable_test'}),null);
});
test('guest and two account caches stay separate, including metadata',()=>{
 const memory=new Memory(),store=new Q.Store(memory);
 store.setItem(Q.FIELDS.chapters,JSON.stringify({guest:{note:'guest'}}));
 store.switchOwner(A);assert.deepEqual(store.read(),Q.empty());store.setItem(Q.FIELDS.chapters,JSON.stringify({private:{note:'A'}}));store.saveMeta({revision:3});
 store.switchOwner(B);assert.deepEqual(store.read(),Q.empty());assert.deepEqual(store.meta(),{});
 store.switchOwner(null);assert.equal(store.read().chapters.guest.note,'guest');
 store.switchOwner(A);assert.equal(store.read().chapters.private.note,'A');assert.equal(store.meta().revision,3);
 memory.fail=true;assert.throws(()=>store.setItem(Q.FIELDS.chapters,'{}'));assert.equal(store.read().chapters.private.note,'A');
});
test('three-way merge preserves unrelated notes and combines chapter additions/cancellations',()=>{
 const base=Q.empty();base.chapters.d={c:{observation:'old',interpretation:'old'}};base.reading.d={chapters:['one','two']};
 const local=structuredClone(base),remote=structuredClone(base);
 local.chapters.d.c.observation='local';remote.chapters.d.c.interpretation='remote';
 local.reading.d.chapters=['two','three'];remote.reading.d.chapters=['one','two','four'];
 const result=Q.merge(base,local,remote);assert.equal(result.conflicts.length,0);
 assert.deepEqual(result.value.chapters.d.c,{observation:'local',interpretation:'remote'});
 assert.deepEqual(result.value.reading.d.chapters,['four','three','two']);
 remote.chapters.d.c.observation='other';const conflict=Q.merge(base,local,remote);
 assert.equal(conflict.conflicts.length,1);assert.equal(conflict.value.chapters.d.c.observation,'local');
 assert.equal(Q.merge(base,local,remote,'remote').value.chapters.d.c.observation,'other');
});
test('deleted QT ranges sync without restoring them or removing other records',async()=>{
 const store=new Q.Store(new Memory()),client=remoteClient(),a=account(client,store);
 const base=Q.empty();
 base.chapters.d={c:{sessions:{'1-2':{completed:true},'3-4':{completed:true}}}};
 base.reading.d={chapters:['one']};client.set(base);await a.init();
 const local=structuredClone(base.chapters);delete local.d.c.sessions['1-2'];
 store.setItem(Q.FIELDS.chapters,JSON.stringify(local));clearTimeout(a.timer);
 const remote=structuredClone(base);remote.chapters.other={note:'second device'};client.set(remote);
 await a.sync();
 assert.equal(a.status,'synced');
 assert.deepEqual(Object.keys(client.row.chapters.d.c.sessions),['3-4']);
 assert.equal(client.row.chapters.other.note,'second device');
 assert.deepEqual(client.row.reading,base.reading);
 const second=new Q.Store(new Memory());await account(client,second).init();
 assert.equal(second.read().chapters.d.c.sessions['1-2'],undefined);
});
test('a new device downloads cloud records without importing guest records',async()=>{
 const memory=new Memory(),store=new Q.Store(memory),client=remoteClient();
 store.setItem(Q.FIELDS.chapters,JSON.stringify({guest:{note:'guest'}}));
 const saved=Q.empty();saved.chapters.day={note:'private'};client.set(saved);
 const a=account(client,store);await a.init();
 assert.equal(a.status,'synced');assert.equal(store.read().chapters.day.note,'private');assert.equal(store.read().chapters.guest,undefined);
 await a.logout();assert.equal(store.owner,null);assert.equal(store.read().chapters.guest.note,'guest');assert.equal(store.read().chapters.day,undefined);
});
test('concurrent earned-day criteria keep both devices achievements',()=>{
 const base=Q.empty();base.reading.day={completedRules:[{dailyGoal:1,completionRule:'qt',skipSundayQt:false}]};
 const local=structuredClone(base),remote=structuredClone(base);
 local.reading.day.completedRules.push({dailyGoal:2,completionRule:'reading',skipSundayQt:false});
 remote.reading.day.completedRules.push({dailyGoal:3,completionRule:'both',skipSundayQt:false});
 const result=Q.merge(base,local,remote);
 assert.equal(result.conflicts.length,0);assert.equal(result.value.reading.day.completedRules.length,3);
});
test('offline pending changes survive a reload and merge with edits from a second device',async()=>{
 const memory=new Memory(),store=new Q.Store(memory),client=remoteClient(),a=account(client,store);
 await a.init();store.setItem(Q.FIELDS.chapters,JSON.stringify({local:{note:'L'}}));clearTimeout(a.timer);
 client.fail=true;await a.sync();assert.equal(a.status,'error');assert.equal(store.read().chapters.local.note,'L');
 const remote=Q.empty();remote.chapters.remote={note:'R'};client.set(remote);client.fail=false;
 const again=account(client,new Q.Store(memory));await again.init();
 assert.equal(again.status,'synced');assert.deepEqual(Object.keys(client.row.chapters).sort(),['local','remote']);
});
test('same-note conflicts require selection and retain both versions in a backup',async()=>{
 const store=new Q.Store(new Memory()),client=remoteClient(),a=account(client,store);
 const base=Q.empty();base.chapters.d={observation:'base'};client.set(base);await a.init();
 store.setItem(Q.FIELDS.chapters,JSON.stringify({d:{observation:'local'}}));clearTimeout(a.timer);
 const remote=structuredClone(base);remote.chapters.d.observation='remote';client.set(remote);
 await a.sync();assert.equal(a.status,'conflict');assert.equal(client.row.chapters.d.observation,'remote');
 await a.resolve('local');assert.equal(client.row.chapters.d.observation,'local');
 const backup=JSON.parse(store.storage.getItem('quolingo-conflict:'+A));assert.equal(backup.remote.chapters.d.observation,'remote');
});
test('changes typed during upload remain queued and are saved on the next pass',async()=>{
 const store=new Q.Store(new Memory()),client=remoteClient(),a=account(client,store);await a.init();
 store.setItem(Q.FIELDS.chapters,JSON.stringify({d:{observation:'first'}}));clearTimeout(a.timer);
 const rpc=client.rpc;let release;client.rpc=async(...args)=>{await new Promise(resolve=>release=resolve);return rpc(...args);};
 const pending=a.sync();while(!release)await new Promise(resolve=>setTimeout(resolve,0));
 store.setItem(Q.FIELDS.chapters,JSON.stringify({d:{observation:'second'}}));clearTimeout(a.timer);release();await pending;
 assert.equal(client.row.chapters.d.observation,'first');assert.equal(store.read().chapters.d.observation,'second');
 clearTimeout(a.timer);client.rpc=rpc;await a.sync();assert.equal(client.row.chapters.d.observation,'second');
});
test('an old request cannot restore another user after switching accounts',async()=>{
 const store=new Q.Store(new Memory()),client=remoteClient(),a=account(client,store);await a.init();
 let release;const old=client.from;client.from=()=>({select:()=>({eq(){return this;},maybeSingle:()=>new Promise(resolve=>release=resolve)})});
 const pending=a.sync();await a.session(null);release({data:{payload:{chapters:{secret:{note:'A'}}},revision:1}});await pending;
 assert.equal(store.owner,null);assert.equal(store.read().chapters.secret,undefined);assert.equal(a.user,null);client.from=old;
});
test('guest import is explicit and does not remove the original guest records',async()=>{
 const store=new Q.Store(new Memory()),client=remoteClient();store.setItem(Q.FIELDS.chapters,JSON.stringify({old:{note:'guest'}}));
 const a=account(client,store);await a.init();assert.deepEqual(store.read().chapters,{});
 await a.importGuest();assert.equal(client.row.chapters.old.note,'guest');await a.logout();assert.equal(store.read().chapters.old.note,'guest');
});
