# Bible text source

Joshua (여호수아) 1–24, all 658 verses: Korean Revised Version (KorRV / 개역한글).

- Source: https://github.com/scrollmapper/bible_databases
- Immutable data: https://raw.githubusercontent.com/scrollmapper/bible_databases/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/formats/json/KorRV.json
- Revision: `e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c`
- SHA-256 of the source JSON: `ffdafc000a0555f87c889c03638b631ff27d033fe9aed0ef89b38d04b576c4bf`
- Extracted the Joshua book; verse text and verse order are unchanged.
- Chapter headings are Quolingo navigation labels, separate from the Bible text.
- The original Psalm excerpts remain for reading existing user journals.

The source repository publishes the following MIT permission notice:

## MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Complete Bible · 구약 39권 / 신약 27권

성경 본문 저작자: 대한성서공회, 『성경전서 개역한글판』(1961).

The Old Testament (39 books, 929 chapters, 23,145 numbered verses) and New Testament (27 books, 260 chapters, 7,957 numbered verses) are extracted without text changes from:

- Dataset: https://github.com/bluesaurel/Korean-Bible-1961-KRV
- Immutable source: https://raw.githubusercontent.com/bluesaurel/Korean-Bible-1961-KRV/2fdb91e77d323b99bacaa9b61fc18f318b703240/bible_1961_krv.json
- Revision: `2fdb91e77d323b99bacaa9b61fc18f318b703240`
- SHA-256 of the source JSON: `65c6d99f80a5a47b9c0d144f313ac533f482454f336d3a82fc1dcedb020612e2`
- SHA-256 of the extracted New Testament canonical verse lines: `8e3875aad62d8d170dfd3d7c4015e3de79ffaf6f4db4b79d2961717c228bb745`
- SHA-256 of the extracted Old Testament canonical verse lines: `2e7b6a925bfaab5b60a3d69e87adb28c98ca0b1e1d647e3d1a3ef817d9b36049`
- Source notice: https://github.com/bluesaurel/Korean-Bible-1961-KRV/blob/2fdb91e77d323b99bacaa9b61fc18f318b703240/README.md
- Bible Society of Korea notice linked by the dataset: https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&wr_id=5

Original spelling, verse numbering, combined-verse repetitions and `(없음)` entries are retained as supplied by the source. The dataset's verification notes do not imply official endorsement or a guarantee of textual identity with an official edition. Quolingo stores the content locally for static hosting and does not modify the wording of the selected verses.

For compatibility, active Joshua chapters continue to use the original scrollmapper extraction described above; the previous Psalm excerpts keep their `psalm-N` identities for old journals, while the complete Psalms book uses `psalms-N`. No saved journal IDs or text fields are rewritten. The active Bible contains 66 books, 1,189 chapters and 31,102 numbered verses.

## Supabase JavaScript SDK

- Version: `@supabase/supabase-js` 2.118.0 (bundled UMD)
- Source: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js
- License: MIT, included in `vendor/SUPABASE-LICENSE`
- File: `vendor/supabase-2.118.0.js`
- SHA-256: `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`

## 사용자가 제공한 개역개정 · 표준새번역개정 본문

2026-10-22에 사용자가 제공한 다음 파일을 `bible-data/nkrv.json`과 `bible-data/rnksv.json`으로 변환했습니다. 두 파일은 CP949 인코딩이며 각각 66권·1,189장을 포함합니다. 개역개정은 개역개정 4판, 새번역 선택 항목은 제공된 표준새번역개정판 파일에 대응합니다. 정적 데이터는 제공 파일의 문구·소제목·각주를 보존하며 대한성서공회의 공식 검증이나 보증을 의미하지 않습니다.

| 번역본 | 제공 파일 | 원본 SHA-256 |
| --- | --- | --- |
| 개역개정 | 개역개정4판(구약+신약).txt | `e6069768f15ce7b74295cff308530caef8f95be9f3609bcb4aa46edcdebce8a3` |
| 새번역 | 표준새번역개정판.txt | `d21fa687208e2dac438a56e17e3a5c6f11709271e008827a5b40cdd382bb3413` |

`scripts/import_bible_editions.py`가 원본을 읽고 권·장·절을 검증합니다. 개역개정의 붙어 있는 권 경계 64곳을 분리하고, 절 번호가 없는 이어지는 문장 45곳을 앞 절에 붙이며, 합쳐진 절 11곳과 시편의 권 제목 4곳을 별도로 보존합니다. 개역개정 파일에 없는 사도행전 24:7은 다른 자료로 채우지 않고 누락 안내를 표시합니다. `18–19`처럼 합쳐진 절은 본문을 한 번만 표시합니다. 표준새번역개정의 권 머리말 66개는 본문과 구분합니다.

번역본마다 실제 절 번호가 다른 장은 각 파일의 번호를 따릅니다. 예를 들어 사무엘상 30장은 제공된 두 번역본에서 31절이며, 제공된 새번역의 요한계시록 12장은 18절입니다. 기존 개역한글 파일과 저장된 기록의 권·장 ID는 변경하지 않습니다. 텍스트는 필요한 번역본을 처음 읽을 때 로컬 JSON에서 불러오고, 설치 앱은 정적 캐시를 준비한 뒤 세 번역본 모두 오프라인에서 읽을 수 있습니다.

재생성 예시:

```sh
python3 scripts/import_bible_editions.py --nkrv '개역개정4판(구약+신약).txt' --rnksv '표준새번역개정판.txt'
```
