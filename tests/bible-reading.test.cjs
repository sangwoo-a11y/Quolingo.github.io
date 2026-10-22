const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Bible=require('../bible-reading.js');
const books=vm.runInNewContext(['old-testament.js','new-testament.js','chapters.js'].map(file=>fs.readFileSync(require.resolve('../'+file),'utf8')).join('\n')+'\nBOOKS');
test('all 66 books have official NKRV and RNKSV links, preserving chapter and start verse',()=>{
 assert.equal(books.length,66);
 for(const book of books)for(const chapter of book.chapters)for(const version of ['nkrv','rnksv']){
  const url=new URL(Bible.officialURL(version,book.id,chapter.chapter,1));
  assert.equal(url.origin,'https://www.bskorea.or.kr');assert.equal(url.pathname,'/bible/korbibReadpage.php');
  assert.equal(url.searchParams.get('chap'),String(chapter.chapter));assert.ok(url.searchParams.get('book'));
 }
 const url=new URL(Bible.officialURL('nkrv','joshua',6,3));assert.equal(url.searchParams.get('version'),'GAE');assert.equal(url.searchParams.get('book'),'jos');assert.equal(url.searchParams.get('sec'),'3');
});
test('새번역 uses SAENEW, without substituting the older standard translation or local KRV',()=>{
 assert.equal(new URL(Bible.officialURL('rnksv','john',3,16)).searchParams.get('version'),'SAENEW');
 assert.equal(Bible.officialURL('krv','genesis',1),null);assert.equal(Bible.officialURL('unknown','genesis',1),null);
 assert.equal(Bible.officialURL('nkrv','constructor',1),null);assert.equal(Bible.officialURL('nkrv','genesis',0),null);
 assert.equal(Bible.officialURL('nkrv','genesis',1,-1),null);
});
