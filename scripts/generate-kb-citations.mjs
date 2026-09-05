/**
 * 生成内置知识库完整引用列表（v5 §9.8 / 操作手册 §5.3）
 * 输出：
 *  - docs/内置知识库引用列表.md   人类可读：书目元数据 + 章节目录 + 段级引用
 *  - data/.kb/citation-index.json 机器可读：全部内置 CitationRef 完整索引
 * 用法：node scripts/generate-kb-citations.mjs（经 tsx 运行，导入 knowledge 包）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinCorpus } from '../packages/knowledge/src/builtin.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_MD = join(ROOT, 'docs', '内置知识库引用列表.md');
const OUT_JSON = join(ROOT, 'data', '.kb', 'citation-index.json');

const all = builtinCorpus();

// 书目统计（按 book 聚合；canonicalId 仅作示例，周易卦辞/爻辞分属 guaci/yaoci）
const byBook = new Map();
for (const s of all) {
  const key = s.book;
  if (!byBook.has(key)) byBook.set(key, { book: s.book, author: s.author ?? '佚名', edition: s.edition ?? '内置公有领域转录', segs: [], canonicalIds: new Set() });
  const info = byBook.get(key);
  info.segs.push(s);
  info.canonicalIds.add(s.canonicalId);
}

// 章节统计（周易按卦名聚合为 64 章；其余书籍保留原章名）
function normalizeChapter(s) {
  if (s.book === '周易') {
    const base = s.chapter.split('·')[0];
    return base ? `${base}（卦辞 + 6 爻辞）` : s.chapter;
  }
  return s.chapter;
}

const bookChapters = new Map();
for (const s of all) {
  if (!bookChapters.has(s.book)) bookChapters.set(s.book, new Map());
  const chMap = bookChapters.get(s.book);
  const ch = normalizeChapter(s);
  if (!chMap.has(ch)) chMap.set(ch, []);
  chMap.get(ch).push(s);
}

const totalSegs = all.length;
const totalBooks = byBook.size;
const totalChapters = [...bookChapters.values()].reduce((n, m) => n + m.size, 0);

function escMd(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

let md = `# 玄枢 · 内置知识库完整引用列表

> **生成时间**：${new Date().toISOString().slice(0, 10)}　**语料规模**：${totalBooks} 部书 · ${totalChapters} 章 · **${totalSegs} 段**
>
> 本列表由 \`scripts/generate-kb-citations.mjs\` 从 \`data/.kb/books/*/corpus.jsonl\` 与 core 内嵌《周易》数据自动生成，勿手改。
> 语料更新后重新运行该脚本即可再生成；引用校验见 \`node scripts/run.mjs verify-citation\`。

## 一、书目总览

| # | 书名 | 作者 | 版本/来源 | 章节 | 段数 | canonicalId |
|---|---|---|---|---|---|---|
`;

let i = 0;
for (const [book, info] of byBook) {
  i += 1;
  const chCount = bookChapters.get(book)?.size ?? 0;
  const cids = [...info.canonicalIds].map((c) => `\`${c}\``).join(' / ');
  md += `| ${i} | ${escMd(book)} | ${escMd(info.author)} | ${escMd(info.edition)} | ${chCount} | ${info.segs.length} | ${cids} |\n`;
}
md += `\n**合计：${totalBooks} 部书 · ${totalChapters} 章 · ${totalSegs} 段（置信度均为 A 级原典转录，许可均为公有领域）**\n`;

md += `
---

## 二、逐书章节引用清单

`;

for (const [book, info] of byBook) {
  const chMap = bookChapters.get(book) ?? new Map();
  md += `### 《${book}》（\`${[...info.canonicalIds].join(' / ')}\`）\n\n`;
  md += `- 作者：${info.author}\n- 版本：${info.edition}\n- 章节数：${chMap.size}　段数：${info.segs.length}\n\n`;
  md += `| 章 | 段数 | 首段 segId | 末段 segId |\n|---|---|---|---|\n`;
  for (const [chapter, segs] of chMap) {
    const first = segs[0].segId;
    const last = segs[segs.length - 1].segId;
    md += `| ${escMd(chapter)} | ${segs.length} | \`${first}\` | \`${last}\` |\n`;
  }
  md += `\n`;
}

md += `---

## 三、段级完整引用列表

> 格式：\`segId\` · 《书名》· 章节 —— 原文（断句保留）。共 ${totalSegs} 段。

`;

for (const s of all) {
  md += `- \`${s.segId}\` · 《${escMd(s.book)}》· ${escMd(s.chapter)} —— ${escMd(s.text)}\n`;
}

mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, md, 'utf-8');
writeFileSync(OUT_JSON, JSON.stringify(all, null, 1), 'utf-8');

console.log(`✓ 已生成引用列表：${totalBooks} 部书 / ${totalChapters} 章 / ${totalSegs} 段`);
console.log(`  - ${OUT_MD}（${(md.length / 1024).toFixed(0)} KB）`);
console.log(`  - ${OUT_JSON}（${(JSON.stringify(all, null, 1).length / 1024).toFixed(0)} KB）`);
