(function(root){
  'use strict';
  const FIELDS={profile:'quolingo-profile-v1',chapters:'quolingo-chapters-v2',reading:'quolingo-reading-v1',legacyEntries:'quolingo-journal-v1'};
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const empty=()=>({profile:{},chapters:{},reading:{},legacyEntries:{}});
  function snapshot(value={}) {return Object.fromEntries(Object.keys(FIELDS).map(key=>[key,object(value[key])?clone(value[key]):{}]));}
  function equal(a,b) {
    if(a===b)return true;
    if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
    if(object(a)&&object(b)){const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}
    return false;
  }
  function merge(base,local,remote,choice='local') {
    const conflicts=[];
    function visit(b,l,r,path) {
      if(equal(l,r))return clone(l);
      if(equal(l,b))return clone(r);
      if(equal(r,b))return clone(l);
      if(path.at(-1)==='completedRules'&&[b,l,r].every(value=>value===undefined||Array.isArray(value))){
        // Completion criteria are append-only; concurrent achievements retain both snapshots.
        return [...(l||[]),...(r||[])].filter((value,index,all)=>all.findIndex(other=>equal(other,value))===index).map(clone);
      }
      const setPath=['read','chapters'].includes(path.at(-1));
      if(setPath&&[b,l,r].every(v=>v===undefined||Array.isArray(v))&&[...(b||[]),...(l||[]),...(r||[])].every(v=>typeof v==='string'||Number.isInteger(v))){
        const values=[...new Set([...(b||[]),...(l||[]),...(r||[])])];
        return values.filter(v=>{const had=(b||[]).includes(v),here=(l||[]).includes(v),there=(r||[]).includes(v);return here===had?there:here;}).sort((a,b)=>typeof a==='number'?a-b:String(a).localeCompare(String(b)));
      }
      if((b===undefined||object(b))&&object(l)&&object(r)){
        const result={};
        for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){
          if(['__proto__','constructor','prototype'].includes(key))continue;
          const value=visit(b?.[key],l[key],r[key],[...path,key]);if(value!==undefined)result[key]=value;
        }
        return result;
      }
      conflicts.push({path,local:clone(l),remote:clone(r)});
      return clone(choice==='remote'?r:l);
    }
    return {value:snapshot(visit(snapshot(base),snapshot(local),snapshot(remote),[])),conflicts};
  }
  function config(value) {
    try {
      const url=new URL(value?.url),key=String(value?.publishableKey||'');
      if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
      if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)){
        const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(payload.role!=='anon')return null;
      }
      return {url:url.origin,key};
    }catch{return null;}
  }
  class Store {
    constructor(storage){this.storage=storage;this.owner=null;this.onChange=()=>{};}
    switchOwner(id){if(id!==null&&!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))throw new Error('Invalid account');this.owner=id;}
    parse(key){try{const value=JSON.parse(this.storage.getItem(key)||'{}');return object(value)?value:{};}catch{return {};}}
    read(owner=this.owner){return owner?snapshot(this.parse('quolingo-user:'+owner)):Object.fromEntries(Object.entries(FIELDS).map(([field,key])=>[field,this.parse(key)]));}
    getItem(key){if(!this.owner)return this.storage.getItem(key);const field=Object.keys(FIELDS).find(field=>FIELDS[field]===key);return field?JSON.stringify(this.read()[field]):null;}
    setItem(key,value){
      if(!this.owner)this.storage.setItem(key,value);
      else{const field=Object.keys(FIELDS).find(field=>FIELDS[field]===key);if(!field)throw new Error('Unknown record');const next=this.read();next[field]=JSON.parse(value);this.write(next);}
      this.onChange();
    }
    write(value){if(!this.owner)throw new Error('Account required');this.storage.setItem('quolingo-user:'+this.owner,JSON.stringify(snapshot(value)));}
    meta(){return this.owner?this.parse('quolingo-sync:'+this.owner):{};}
    saveMeta(value){this.storage.setItem('quolingo-sync:'+this.owner,JSON.stringify(value));}
    backup(value){this.storage.setItem('quolingo-conflict:'+this.owner,JSON.stringify({savedAt:new Date().toISOString(),...value}));}
    hasGuest(){const value=this.read(null);return ['chapters','reading','legacyEntries'].some(key=>Object.keys(value[key]).some(date=>key!=='reading'||(value.reading[date].chapters||[]).length));}
  }
  class Account {
    constructor({client,store,onScope=()=>{},onData=()=>{},onStatus=()=>{},delay=800}){
      Object.assign(this,{client,store,onScope,onData,onStatus,delay});this.user=null;this.epoch=0;this.ready=false;this.status='guest';this.conflicts=[];this.busy=null;this.timer=null;this.scope=undefined;this.again=false;this.importing=null;
      store.onChange=()=>this.changed();
    }
    emit(status){this.status=status;this.onStatus(this);}
    async init(){
      if(!this.client){this.ready=true;this.scope=null;this.onScope(null);this.emit('unconfigured');return;}
      this.client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{void this.session(session).catch(()=>this.emit('error'));},0);});
      try{const {data,error}=await this.client.auth.getSession();if(error)throw error;await this.session(data.session);}
      catch{this.ready=true;this.store.switchOwner(null);this.scope=null;this.onScope(null);this.emit('error');}
    }
    async session(session){
      const user=session?.user||null,id=user?.id||null;
      if(this.scope===id){this.user=user;return;}
      const epoch=++this.epoch;clearTimeout(this.timer);this.timer=null;this.busy=null;this.importing=null;this.conflicts=[];this.again=false;
      this.user=user;this.scope=id;this.ready=false;this.store.switchOwner(id);this.onScope(user);this.ready=true;
      if(!user){this.emit('guest');return;}
      this.emit('loading');await this.sync();if(epoch!==this.epoch)return;
    }
    changed(){
      if(!this.user||!this.ready)return;
      this.again=true;
      if(this.status==='conflict'||this.importing){this.onStatus(this);return;}
      this.emit('pending');clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.sync();},this.delay);
    }
    async sync(choice){
      if(!this.client||!this.user||!this.ready||this.importing)return;
      if(this.busy){this.again=true;return this.busy;}
      clearTimeout(this.timer);const epoch=this.epoch;this.again=false;
      const task=this.run(epoch,choice);this.busy=task;
      try{await task;}finally{if(epoch===this.epoch){this.busy=null;if(this.again&&!['conflict','error'].includes(this.status))this.changed();}}
    }
    async run(epoch,choice){
      const owner=this.user.id;
      this.emit('syncing');
      try{
        for(let retry=0;retry<3;retry++){
          const {data,error}=await this.client.from('quolingo_state').select('payload,revision').eq('user_id',owner).maybeSingle();
          if(epoch!==this.epoch)return;if(error)throw error;
          const remote=snapshot(data?.payload),revision=data?.revision||0,base=snapshot(this.store.meta().base),local=this.store.read();
          const result=merge(base,local,remote,choice);
          if(result.conflicts.length&&!choice){this.conflicts=result.conflicts;this.emit('conflict');return;}
          if(result.conflicts.length)this.store.backup({local,remote});
          if(!equal(result.value,local)){this.store.write(result.value);this.onData();}
          if(equal(result.value,remote)){this.store.saveMeta({base:remote,revision,syncedAt:new Date().toISOString()});this.conflicts=[];this.emit('synced');return;}
          const saved=await this.client.rpc('save_quolingo_state',{p_user_id:owner,p_expected_revision:revision,p_payload:result.value});
          if(epoch!==this.epoch)return;if(saved.error)throw saved.error;
          if(!saved.data?.saved)continue;
          this.store.saveMeta({base:result.value,revision:saved.data.revision,syncedAt:new Date().toISOString()});this.conflicts=[];
          if(!equal(this.store.read(),result.value)){this.again=true;this.emit('pending');}else this.emit('synced');
          return;
        }
        this.emit('error');
      }catch{if(epoch===this.epoch)this.emit('error');}
    }
    async resolve(choice){
      if(!['local','remote'].includes(choice))return;
      if(this.importing){
        const local=this.store.read(),guest=this.store.read(null),result=merge(empty(),guest,local,choice==='local'?'local':'remote');
        try{this.store.backup({local:guest,remote:local});this.store.write(result.value);this.importing=null;this.conflicts=[];this.onData();await this.sync();}catch{this.emit('error');}
      }else await this.sync(choice);
    }
    async importGuest(){
      if(!this.user||this.busy||!this.store.hasGuest())return;
      const guest=this.store.read(null),local=this.store.read();
      const hasRecords=Object.keys(local.chapters).length||Object.keys(local.legacyEntries).length||Object.values(local.reading).some(day=>(day.chapters||[]).length);
      const result=hasRecords?merge(empty(),guest,local):{value:guest,conflicts:[]};
      if(result.conflicts.length){this.importing=true;this.conflicts=result.conflicts;this.emit('conflict');return;}
      try{this.store.write(result.value);this.onData();await this.sync();}catch{this.emit('error');}
    }
    async login(redirectTo){
      if(!this.client)return;
      try{const {error}=await this.client.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)throw error;}catch{this.emit('auth-error');}
    }
    async logout(){
      if(!this.client)return;
      try{const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;await this.session(null);}catch{this.emit('auth-error');}
    }
  }
  const api={FIELDS,empty,snapshot,equal,merge,config,Store,Account};root.QuolingoCloud=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
