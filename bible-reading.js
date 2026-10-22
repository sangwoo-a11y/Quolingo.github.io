// Only KRV is bundled. NKRV and RNKSV open the Bible Society of Korea reader.
const BibleReading = (() => {
  const names=Object.freeze({krv:'개역한글',nkrv:'개역개정',rnksv:'새번역'});
  // SAENEW is 새번역; SAE is the older 표준새번역 and must not be substituted.
  const officialVersions={nkrv:'GAE',rnksv:'SAENEW'};
  const bookCodes={
    genesis:'gen',exodus:'exo',leviticus:'lev',numbers:'num',deuteronomy:'deu',joshua:'jos',judges:'jdg',ruth:'rut',
    '1-samuel':'1sa','2-samuel':'2sa','1-kings':'1ki','2-kings':'2ki','1-chronicles':'1ch','2-chronicles':'2ch',
    ezra:'ezr',nehemiah:'neh',esther:'est',job:'job',psalms:'psa',proverbs:'pro',ecclesiastes:'ecc','song-of-solomon':'sng',
    isaiah:'isa',jeremiah:'jer',lamentations:'lam',ezekiel:'ezk',daniel:'dan',hosea:'hos',joel:'jol',amos:'amo',obadiah:'oba',jonah:'jon',
    micah:'mic',nahum:'nam',habakkuk:'hab',zephaniah:'zep',haggai:'hag',zechariah:'zec',malachi:'mal',
    matthew:'mat',mark:'mrk',luke:'luk',john:'jhn',acts:'act',romans:'rom','1-corinthians':'1co','2-corinthians':'2co',
    galatians:'gal',ephesians:'eph',philippians:'php',colossians:'col','1-thessalonians':'1th','2-thessalonians':'2th',
    '1-timothy':'1ti','2-timothy':'2ti',titus:'tit',philemon:'phm',hebrews:'heb',james:'jas','1-peter':'1pe','2-peter':'2pe',
    '1-john':'1jn','2-john':'2jn','3-john':'3jn',jude:'jud',revelation:'rev'
  };
  function officialURL(version,bookId,chapter,start=1) {
    if(!Object.hasOwn(officialVersions,version)||!Object.hasOwn(bookCodes,bookId)||!Number.isInteger(chapter)||chapter<1||chapter>150||!Number.isInteger(start)||start<1||start>176)return null;
    const url=new URL('https://www.bskorea.or.kr/bible/korbibReadpage.php');
    url.search=new URLSearchParams({version:officialVersions[version],book:bookCodes[bookId],chap:String(chapter),sec:String(start)}).toString();
    return url.href;
  }
  return {names,officialURL};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=BibleReading;
