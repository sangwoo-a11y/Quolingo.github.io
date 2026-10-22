const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Bible=require('../bible-reading.js');
const index=require('../bible-editions.js');
const books=vm.runInNewContext(['old-testament.js','new-testament.js','chapters.js'].map(file=>fs.readFileSync(require.resolve('../'+file),'utf8')).join('\n')+'\nBOOKS');
const chapters=new Map(Array.from(books,b=>Array.from(b.chapters,c=>[c.id,c])).flat());
const data=Object.fromEntries(['nkrv','rnksv'].map(version=>[version,JSON.parse(fs.readFileSync(path.join(__dirname,'../bible-data',version+'.json'),'utf8'))]));
const local=async url=>({ok:true,json:async()=>data[path.basename(url,'.json')]});
test('both supplied editions cover all 66 books and 1189 chapters without changing the original KRV',async()=>{
 for(const version of ['nkrv','rnksv']){
  await Bible.load(version,local);assert.equal(Object.keys(data[version].chapters).length,1189);
  assert.equal(Object.values(index[version]).reduce((a,b)=>a+b,0),31102);
  for(const [id,c] of chapters){assert.ok(data[version].chapters[id]);assert.equal(Bible.count(c,version),data[version].chapters[id].count);}
 }
 assert.equal(data.nkrv.source.sha256,'e6069768f15ce7b74295cff308530caef8f95be9f3609bcb4aa46edcdebce8a3');
 assert.equal(data.rnksv.source.sha256,'d21fa687208e2dac438a56e17e3a5c6f11709271e008827a5b40cdd382bb3413');
 assert.equal(Bible.rows(chapters.get('genesis-1'),'krv',1,1)[0].text,'태초에 하나님이 천지를 창조하시니라');
});
test('book boundaries, unnumbered continuation paragraphs and combined ranges retain their source text',async()=>{
 await Bible.load('nkrv',local);await Bible.load('rnksv',local);
 const genesis=Bible.rows(chapters.get('genesis-50'),'nkrv',26,26)[0];assert.doesNotMatch(genesis.text,/출1:1|야곱과 함께/);
 assert.match(Bible.rows(chapters.get('exodus-1'),'nkrv',1,1)[0].text,/야곱과 함께 각각 자기 가족/);
 assert.match(Bible.rows(chapters.get('genesis-35'),'nkrv',22,22)[0].text,/\n야곱의 <야곱의 아들들/);
 const range=Bible.rows(chapters.get('deuteronomy-6'),'nkrv',18,19);assert.equal(range.length,1);assert.equal(range[0].start,18);assert.equal(range[0].end,19);
 assert.deepEqual(Bible.rows(chapters.get('deuteronomy-6'),'nkrv',19,19),range);
 assert.deepEqual(Bible.headings(chapters.get('psalms-42'),'nkrv'),['제이권']);
 assert.equal(Bible.rows(chapters.get('acts-24'),'nkrv',7,7)[0].text,null);
});
test('edition-specific numbering supports extra and combined verse numbers without KRV substitution',async()=>{
 await Bible.load('nkrv',local);await Bible.load('rnksv',local);
 const sam=chapters.get('1-samuel-30'),rev=chapters.get('revelation-12');
 assert.equal(Bible.count(sam,'krv'),30);assert.equal(Bible.count(sam,'nkrv'),31);assert.equal(Bible.count(sam,'rnksv'),31);
 assert.equal(Bible.count(rev,'krv'),17);assert.equal(Bible.count(rev,'rnksv'),18);assert.equal(Bible.maxCount(rev),18);
 assert.equal(Bible.count(chapters.get('psalms-72'),'rnksv'),19);assert.equal(Bible.count(chapters.get('ezekiel-15'),'rnksv'),7);
 assert.match(Bible.rows(rev,'rnksv',18,18)[0].text,/바닷가 모래/);
 assert.equal(Bible.rows(rev,'krv',18,18)[0].text,null);
 const legacy={id:'psalm-23',chapter:23,verses:['legacy']};assert.equal(Bible.count(legacy,'rnksv'),6);assert.match(Bible.rows(legacy,'rnksv',1,1)[0].text,/주님/);
});
test('concurrent loads share a request, reject invalid data and can retry failures',async()=>{
 delete require.cache[require.resolve('../bible-reading.js')];const fresh=require('../bible-reading.js');let calls=0;
 await assert.rejects(fresh.load('nkrv',async()=>({ok:false})));assert.equal(fresh.ready('nkrv'),false);
 await assert.rejects(fresh.load('nkrv',async()=>({ok:true,json:async()=>({edition:'rnksv',chapters:{}})})));
 const request=async url=>{calls++;return local(url);};await Promise.all([fresh.load('nkrv',request),fresh.load('nkrv',request)]);assert.equal(calls,1);assert.equal(fresh.ready('nkrv'),true);
 await assert.rejects(fresh.load('unknown',request));assert.equal(calls,1);
});
