#!/usr/bin/env python3
"""Convert supplied NKRV/RNKSV text into static, numbered chapter data.
No network access, text rewriting, or execution of input content.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ALIASES = '창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계'.split()


def canonical_books():
    code = "const fs=require('fs'),vm=require('vm');process.stdout.write(vm.runInNewContext(['old-testament.js','new-testament.js','chapters.js'].map(f=>fs.readFileSync(f,'utf8')).join('\\n')+'\\nJSON.stringify(BOOKS.map(b=>({id:b.id,name:b.name,chapters:b.chapters.length})))'));"
    return json.loads(subprocess.check_output(['node', '-e', code], cwd=ROOT))


def convert(path, edition, books):
    raw = path.read_bytes()
    try:
        text, encoding = raw.decode('utf-8-sig'), 'utf-8'
    except UnicodeDecodeError:
        text, encoding = raw.decode('cp949'), 'cp949'
    aliases = dict(zip(ALIASES, books))
    chapters, headers, covered = {}, {}, {}
    repairs = {'book_boundaries': 0, 'continuations': 0, 'combined_ranges': 0, 'section_headings': 0}
    last_key = None
    lines = text.splitlines()
    if edition == 'nkrv':
        # Only split a next book's 1:1 at a verified end-of-book boundary.
        expanded = []
        for line in lines:
            first = re.match(r'^([^\d\s]+)(\d+):', line)
            if first and first[1] in ALIASES:
                index = ALIASES.index(first[1])
                if index < 65:
                    marker = ALIASES[index + 1] + '1:1 '
                    at = line.find(marker)
                    if at > 0:
                        assert int(first[2]) == books[index]['chapters'], ('unexpected boundary', line)
                        expanded.extend([line[:at], line[at:]])
                        repairs['book_boundaries'] += 1
                        continue
            expanded.append(line)
        lines = expanded
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        if edition == 'rnksv':
            if line == 'F1,표준새번역개정,F1':
                continue
            m = re.fullmatch(r'(\d{2}) (\d+):(\d+) (.*)', line)
            if not m:
                raise ValueError(f'{path.name}:{number}: unrecognized line')
            book = books[int(m[1]) - 1]
            chapter, start = int(m[2]), int(m[3])
            end, body = start, m[4]
            if chapter == start == 0:
                short, name, count = body.split(',')
                expected_short = {ALIASES[int(m[1]) - 1]}
                if book['id'] == 'ezra': expected_short.add('라')
                if book['id'] == 'esther': expected_short.add('더')
                display_name = name.replace('1', '일').replace('2', '이').replace('3', '삼')
                assert short in expected_short and display_name == book['name'] and int(count) == book['chapters']
                headers[book['id']] = True
                continue
        else:
            m = re.fullmatch(r'([^\d\s]+)(\d+):(?:(\d+)(?:-(\d+))?\s+)?(.*)', line)
            if not m or m[1] not in aliases:
                raise ValueError(f'{path.name}:{number}: unrecognized line')
            book, chapter, body = aliases[m[1]], int(m[2]), m[5]
            start, end = (int(m[3]), int(m[4] or m[3])) if m[3] else (None, None)
        if not 1 <= chapter <= book['chapters']:
            raise ValueError(f'{path.name}:{number}: chapter out of range')
        key = f"{book['id']}-{chapter}"
        value = chapters.setdefault(key, {'count': 0, 'rows': []})
        occupied = covered.setdefault(key, set())
        if start is None:
            if re.fullmatch(r'제[이삼사오]권', body):
                value.setdefault('headings', []).append(body)
                repairs['section_headings'] += 1
            else:
                if last_key != key or not value['rows']:
                    raise ValueError(f'{path.name}:{number}: continuation has no preceding verse')
                value['rows'][-1][2] += '\n' + body
                repairs['continuations'] += 1
            continue
        if not 1 <= start <= end <= 176 or not body.strip():
            raise ValueError(f'{path.name}:{number}: invalid verse or empty text')
        numbers = set(range(start, end + 1))
        if occupied & numbers or value['rows'] and start <= value['rows'][-1][1]:
            raise ValueError(f'{path.name}:{number}: duplicate or unsorted verses')
        occupied.update(numbers)
        value['rows'].append([start, end, body])
        value['count'] = max(value['count'], end)
        last_key = key
        if end > start:
            repairs['combined_ranges'] += 1
    expected = {f"{book['id']}-{chapter}" for book in books for chapter in range(1, book['chapters'] + 1)}
    assert set(chapters) == expected and len(chapters) == 1189
    if edition == 'rnksv':
        assert len(headers) == 66
    missing = {key: [n for n in range(1, value['count'] + 1) if n not in covered[key]] for key, value in chapters.items()}
    missing = {key: values for key, values in missing.items() if values}
    source = {'file': path.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'encoding': encoding,
              'repairs': repairs, 'missing': missing}
    return {'edition': edition, 'source': source, 'chapters': chapters}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nkrv', type=Path, required=True)
    parser.add_argument('--rnksv', type=Path, required=True)
    args = parser.parse_args()
    books = canonical_books()
    directory = ROOT / 'bible-data'
    directory.mkdir(exist_ok=True)
    index = {}
    for edition in ['nkrv', 'rnksv']:
        result = convert(getattr(args, edition), edition, books)
        (directory / f'{edition}.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        index[edition] = {key: chapter['count'] for key, chapter in result['chapters'].items()}
        print(edition, json.dumps({'chapters': len(index[edition]), 'numbered_verses': sum(index[edition].values()), **result['source']}, ensure_ascii=False))
    (ROOT / 'bible-editions.js').write_text('// Chapter numbering from the supplied text files; existing KRV data stays unchanged.\nconst BIBLE_EDITION_INDEX = ' + json.dumps(index, separators=(',', ':')) + ';\nif(typeof module!==\"undefined\"&&module.exports)module.exports=BIBLE_EDITION_INDEX;\n', encoding='utf-8')


if __name__ == '__main__':
    main()
