/**
 * verify-citation（v5 §9.8）：语料更新后校验引用有效性
 * 遍历 data/.kb/books 下各书 corpus.jsonl 校验每条语料的引用字段完整性。
 */

import { validateCitation } from '../src/citation.ts';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

function findBooksDir() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const cand = join(dir, 'data', '.kb', 'books');
    if (existsSync(cand)) return cand;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function main() {
  const booksDir = findBooksDir();
  if (!booksDir) {
    console.log('⚠ 未找到语料目录 data/.kb/books，内置样例校验如下：');
    const sample = {
      canonicalId: 'zengshanbuyi.ws.1912',
      book: '增删卜易',
      edition: '民国三年校经山房石印本',
      chapter: '卷三·失物章',
      segId: 'zsby.3.12',
      quote: '用神宜旺，不宜空破',
      license: '公有领域',
      confidenceLevel: 'A',
    };
    const r = validateCitation(sample);
    console.log(r.ok ? '✓ 样例引用校验通过' : `✗ 样例问题：${r.issues.join(';')}`);
    process.exit(r.ok ? 0 : 1);
  }
  let total = 0;
  let fail = 0;
  const bookDirs = readdirSync(booksDir).filter((d) => existsSync(join(booksDir, d, 'corpus.jsonl')));
  for (const dir of bookDirs) {
    const lines = readFileSync(join(booksDir, dir, 'corpus.jsonl'), 'utf-8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const item = JSON.parse(line);
      const ref = {
        canonicalId: item.canonicalId,
        book: item.book,
        author: item.author,
        edition: item.edition,
        chapter: item.chapter,
        segId: item.segId,
        quote: item.text,
        license: item.license,
        confidenceLevel: item.confidenceLevel,
      };
      total += 1;
      const res = validateCitation(ref);
      if (!res.ok) {
        fail += 1;
        console.error(`✗ ${item.segId}: ${res.issues.join(';')}`);
      }
    }
  }
  if (fail > 0) {
    console.error(`verify-citation 失败：${fail}/${total} 条问题`);
    process.exit(1);
  }
  console.log(`✓ verify-citation 通过：${total} 条语料引用字段全部有效（${bookDirs.length} 部书）`);
}

main();
