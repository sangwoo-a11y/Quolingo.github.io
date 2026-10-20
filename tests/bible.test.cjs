const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const corpus = vm.runInNewContext(
  fs.readFileSync(path.join(root, 'old-testament.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'new-testament.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'chapters.js'), 'utf8') + '\n' +
  '({books:BOOKS, ot:OLD_TESTAMENT_BOOKS, nt:NEW_TESTAMENT_BOOKS, chapters:CHAPTERS, all:ALL_CHAPTERS})',
  {}, { timeout: 2000 }
);

test('all 27 New Testament books and 260 chapters are complete', () => {
  const chapterCounts = [28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
  assert.equal(corpus.nt.length, 27);
  assert.deepEqual(Array.from(corpus.nt, b => b.chapters.length), chapterCounts);
  assert.equal(corpus.nt.reduce((n, b) => n + b.chapters.length, 0), 260);
  assert.equal(corpus.nt.reduce((n, b) => n + b.chapters.reduce((sum,c) => sum + c.verses.length,0), 0), 7957);
  for (const book of corpus.nt) {
    for (const [i, chapter] of book.chapters.entries()) {
      assert.equal(chapter.chapter, i + 1);
      assert.equal(chapter.book, book.name);
      assert.equal(chapter.bookId, book.id);
      assert.ok(chapter.verses.length > 0);
      assert.ok(chapter.verses.every(text => typeof text === 'string' && text.trim().length > 0));
    }
  }
});

test('verse content matches the pinned 1961 KRV source extraction', () => {
  const lines = [];
  for (const book of corpus.nt) for (const chapter of book.chapters) {
    chapter.verses.forEach((text,i) => lines.push(`${book.id}:${chapter.chapter}:${i+1}:${text}`));
  }
  assert.equal(createHash('sha256').update(lines.join('\n')).digest('hex'),
    '8e3875aad62d8d170dfd3d7c4015e3de79ffaf6f4db4b79d2961717c228bb745');
  assert.equal(corpus.nt[0].chapters[0].verses[0], '아브라함과 다윗의 자손 예수 그리스도의 세계라');
  assert.equal(corpus.nt[26].chapters[21].verses[20], '주 예수의 은혜가 모든 자들에게 있을찌어다 아멘');
});

test('Joshua and archived Psalm journals retain distinct chapter identities', () => {
  assert.equal(corpus.books.length, 66);
  assert.equal(corpus.books[0].id, 'genesis');
  assert.equal(corpus.books.find(b=>b.id==='joshua').chapters.length, 24);
  assert.equal(corpus.chapters.length, 1189);
  assert.equal(corpus.all.length, 1195);
  assert.equal(new Set(Array.from(corpus.all, c => c.id)).size, 1195);
  assert.ok(corpus.all.some(c => c.id === 'psalm-23'));
  assert.ok(corpus.chapters.some(c => c.id === '1-john-1'));
  assert.ok(corpus.chapters.some(c => c.id === 'john-1'));
});


test('all 39 Old Testament books retain the pinned source text and verse order', () => {
  assert.equal(corpus.ot.length, 39);
  assert.deepEqual(Array.from(corpus.ot,b=>b.chapters.length),[50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4]);
  assert.equal(corpus.ot.reduce((n,b)=>n+b.chapters.length,0),929);
  assert.equal(corpus.ot.reduce((n,b)=>n+b.chapters.reduce((sum,c)=>sum+c.verses.length,0),0),23145);
  const lines=[];
  for(const book of corpus.ot) for(const [i,c] of book.chapters.entries()) {
    assert.equal(c.chapter,i+1);
    assert.equal(c.bookId,book.id);
    assert.equal(c.book,book.name);
    assert.ok(c.verses.every(text=>typeof text==='string'&&text.trim()));
    c.verses.forEach((text,n)=>lines.push(`${book.id}:${c.chapter}:${n+1}:${text}`));
  }
  assert.equal(createHash('sha256').update(lines.join('\n')).digest('hex'),'2e7b6a925bfaab5b60a3d69e87adb28c98ca0b1e1d647e3d1a3ef817d9b36049');
  assert.equal(corpus.chapters.reduce((sum,c)=>sum+c.verses.length,0),31102);
  assert.equal(corpus.ot[0].chapters[0].verses[0],'태초에 하나님이 천지를 창조하시니라');
  assert.ok(corpus.chapters.some(c=>c.id==='psalms-150'));
});
