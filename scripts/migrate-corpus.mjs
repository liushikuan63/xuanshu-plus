/**
 * 语料迁移：采纳参考工程（xuanshu / xuanshu-z）已切分的公有领域古籍语料。
 * 输入：D:\Java\GitHub\xuanshu\data\.kb\books\<书>\corpus.jsonl + meta.json
 * 输出：
 *  - data/.kb/books/<书>/corpus.jsonl（拷贝留档）
 *  - packages/knowledge/src/corpus/<书>.ts（打包进 Web/App 的内置语料）
 * 跳过 plus 已有同名书目的语料（周易内嵌 / zengshanbuyi / bushizhengzong / huangjince / yimao）。
 * 用法：node scripts/migrate-corpus.mjs [书1 书2 ...]（缺省=全部缺失书目）
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const SRC = 'D:/Java/GitHub/xuanshu/data/.kb/books';
const DST_DIR = 'data/.kb/books';
const OUT_TS = 'packages/knowledge/src/corpus';

/** plus 已内置（或与之重复）的书目目录，跳过 */
const SKIP = new Set(['zhouyi', 'zengshanbuyi', 'zengshan-buyi', 'zengshan', 'bushizhengzong', 'huangjince', 'yimao']);

const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const dirs = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !SKIP.has(d.name) && existsSync(`${SRC}/${d.name}/corpus.jsonl`))
  .map((d) => d.name)
  .sort();

const targets = requested.length > 0 ? dirs.filter((d) => requested.includes(d)) : dirs;

for (const dir of targets) {
  const metaPath = `${SRC}/${dir}/meta.json`;
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const book = meta.title ?? dir;
  const author = meta.author ?? '';
  const edition = meta.edition ?? '公有领域转录（参考工程语料库采纳）';
  const license = meta.license === '公有领域' || meta.underlyingLicense === 'public-domain' ? '公有领域' : (meta.license ?? '公有领域');

  const lines = readFileSync(`${SRC}/${dir}/corpus.jsonl`, 'utf8').split(/\r?\n/).filter(Boolean);
  const corpus = lines.map((ln, i) => {
    const raw = JSON.parse(ln);
    return {
      segId: raw.segId ?? `${dir}.c.${i + 1}`,
      text: String(raw.text ?? '').trim(),
      chapter: raw.chapter ?? '全卷',
      book: raw.book ?? book,
      canonicalId: raw.canonicalId ?? meta.canonicalId ?? `${dir}.public`,
      ...(raw.author ? { author: raw.author } : author ? { author } : {}),
      edition: raw.edition ?? edition,
      confidenceLevel: raw.confidenceLevel ?? 'A',
      license: raw.license ?? license,
    };
  }).filter((c) => c.text.length >= 4);

  if (corpus.length === 0) {
    console.log(`⏭ ${dir}: 无可迁移段落`);
    continue;
  }

  // 拷贝 jsonl 留档
  mkdirSync(`${DST_DIR}/${dir}`, { recursive: true });
  writeFileSync(`${DST_DIR}/${dir}/corpus.jsonl`, corpus.map((c) => JSON.stringify(c)).join('\n'), 'utf-8');

  // 生成 TS 内置语料
  const tsName = dir.replace(/[^a-z0-9]/gi, '');
  const ts = `/** 内置语料：《${book}》${author ? `（${author}，` : '（'}${edition}）——由 scripts/migrate-corpus.mjs 从参考工程语料库采纳，勿手改 */
import type { CorpusSection } from '../retriever.js';

export const ${tsName}Corpus: CorpusSection[] = ${JSON.stringify(corpus)};
`;
  mkdirSync(OUT_TS, { recursive: true });
  writeFileSync(`${OUT_TS}/${tsName}.ts`, ts, 'utf-8');
  console.log(`✓ ${book}（${dir}）: ${corpus.length} 段 → corpus/${tsName}.ts`);
}
console.log('迁移完成。请将新 corpus 加入 packages/knowledge/src/builtin.ts。');