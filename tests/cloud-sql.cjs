// Optional PostgreSQL/WASM check: PGLITE_MODULE=/path/to/@electric-sql/pglite node tests/cloud-sql.cjs
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,anon;
   insert into auth.users values ('${A}'),('${B}');`);
  const schema=fs.readFileSync(path.join(__dirname,'../supabase/schema.sql'),'utf8');
  await db.exec(schema);await db.exec(schema); // Setup can be run again without destroying records.
  const user=async id=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);};
  let owner=A;
  const save=async(revision,note,expectedOwner=owner)=>(await db.query('select public.save_quolingo_state($1::uuid,$2,$3::jsonb) as result',[expectedOwner,revision,JSON.stringify({chapters:{note}})])).rows[0].result;
  await db.exec('set role anon');await assert.rejects(()=>save(0,'anonymous'),/permission denied/);
  await user(A);assert.deepEqual(await save(0,'A'),{saved:true,revision:1});
  assert.equal((await db.query('select payload from public.quolingo_state')).rows[0].payload.chapters.note,'A');
  await assert.rejects(()=>db.exec("update public.quolingo_state set payload='{}'"),/permission denied/);
  await user(B);owner=B;await assert.rejects(()=>save(0,'A data',A),/Account changed/);assert.equal((await db.query('select * from public.quolingo_state')).rows.length,0);
  assert.equal((await save(1,'overwrite A')).saved,false);
  assert.deepEqual(await save(0,'B'),{saved:true,revision:1});
  await user(A);owner=A;assert.equal((await db.query('select * from public.quolingo_state')).rows.length,1);
  assert.equal((await save(0,'stale')).saved,false);assert.deepEqual(await save(1,'A revised'),{saved:true,revision:2});
  assert.equal((await save(1,'another stale')).saved,false);
  await db.exec("reset role;delete from auth.users where id='"+A+"'");
  assert.equal((await db.query('select * from public.quolingo_state')).rows.length,1);
  console.log('PASS: real PostgreSQL schema, repeatable setup, anonymous access denial, owner-only RLS, no direct writes, authenticated compare-and-swap isolation, stale-write rejection and deletion cascade.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
