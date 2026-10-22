// Text comes only from local edition files supplied for this site.
const BibleReading = (() => {
  const names=Object.freeze({krv:'개역한글',nkrv:'개역개정',rnksv:'새번역'});
  const index=typeof BIBLE_EDITION_INDEX!=='undefined'?BIBLE_EDITION_INDEX:require('./bible-editions.js');
  const editions=new Map(),pending=new Map();
  const key=chapter=>chapter.id.startsWith('psalm-')?'psalms-'+chapter.chapter:chapter.id;
  function count(chapter,version='krv') {return index[version]?.[key(chapter)]||chapter.verses.length;}
  function maxCount(chapter) {return Math.max(chapter.verses.length,...Object.keys(index).map(version=>count(chapter,version)));}
  function ready(version) {return version==='krv'||editions.has(version);}
  function validate(version,value) {
    const expected=index[version];
    if(value?.edition!==version||!value.chapters||Object.keys(value.chapters).length!==Object.keys(expected).length)throw Error('Invalid edition');
    for(const [id,length] of Object.entries(expected)){
      const chapter=value.chapters[id];let end=0;
      if(chapter?.count!==length||!Array.isArray(chapter.rows)||!chapter.rows.length)throw Error('Missing chapter');
      for(const row of chapter.rows){
        if(!Array.isArray(row)||row.length!==3||!Number.isInteger(row[0])||!Number.isInteger(row[1])||row[0]<=end||row[1]<row[0]||row[1]>length||typeof row[2]!=='string'||!row[2].trim())throw Error('Invalid verse');
        end=row[1];
      }
      if(chapter.headings&&(!Array.isArray(chapter.headings)||!chapter.headings.every(text=>typeof text==='string')))throw Error('Invalid heading');
    }
    return value;
  }
  function load(version,request=fetch) {
    if(ready(version))return Promise.resolve();
    if(!Object.hasOwn(index,version))return Promise.reject(Error('Unknown edition'));
    if(pending.has(version))return pending.get(version);
    const task=(async()=>{
      const response=await request(`bible-data/${version}.json`);
      if(!response.ok)throw Error('Unable to load edition');
      const value=validate(version,await response.json());editions.set(version,value);
    })().finally(()=>pending.delete(version));
    pending.set(version,task);return task;
  }
  function rows(chapter,version,start=1,end=count(chapter,version)) {
    if(!ready(version))throw Error('Edition not loaded');
    const source=version==='krv'?chapter.verses.map((text,i)=>[i+1,i+1,text]):editions.get(version).chapters[key(chapter)].rows;
    const result=source.filter(([a,b])=>a<=end&&b>=start).map(([start,end,text])=>({start,end,text}));
    const covered=new Set(result.flatMap(row=>Array.from({length:row.end-row.start+1},(_,i)=>row.start+i)));
    for(let n=start;n<=end;n++)if(!covered.has(n))result.push({start:n,end:n,text:null});
    return result.sort((a,b)=>a.start-b.start);
  }
  function headings(chapter,version) {return version==='krv'?[]:editions.get(version)?.chapters[key(chapter)]?.headings||[];}
  return {names,count,maxCount,ready,load,rows,headings};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BibleReading;
