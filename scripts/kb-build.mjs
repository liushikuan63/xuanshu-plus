/**
 * 内置语料构建器：把 data/.kb/books/<书>/source.txt 切分为章节层级 + 句级段。
 * 输出：
 *  - data/.kb/books/<书>/corpus.jsonl（doc §8.2 格式）
 *  - packages/knowledge/src/corpus/<书>.ts（打包进 Web/App 的内置语料）
 * 用法：node scripts/kb-build.mjs [--all] 或指定书名参数
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

/** 每本书的切分配置 */
const BOOKS = [
  {
    dir: 'zengshanbuyi',
    canonicalId: 'zengshanbuyi.ws.1912',
    book: '增删卜易',
    author: '野鹤老人',
    edition: '公有领域转录（网络流传本）',
    prefix: 'zsby',
    // 章标题：如「八卦章第一」「月破章第二十七」「各门类应期总注章第又二十六」
    chapterRe: /^(.+?章第[又又一二三四五六七八九十百千\d]+)$/,
    volumeRe: /^卷之([一二三四])$/,
    defaultVolume: '卷首',
    specialChapters: ['增删卜易序'],
  },
  {
    dir: 'bushizhengzong',
    canonicalId: 'bushizhengzong.ws.1912',
    book: '卜筮正宗',
    author: '王洪绪',
    edition: '清光绪宏道堂刻本（公有领域转录）',
    prefix: 'bszz',
    // 章标题：如「用神分类定例第一」「月破论第九」「纳甲装卦歌」「六甲旬空起例」等
    chapterRe: /^(.{2,28}?(?:第[一二三四五六七八九十百千\d]+|(?:凡例|目录|论|歌|诀|赋|例|传符|起例|问答|章|定例)[^。，；]*))$/,
    volumeRe: null,
    defaultVolume: '卜筮正宗',
  },
  {
    dir: 'huangjince',
    canonicalId: 'huangjince.ws.1912',
    book: '黄金策',
    author: '刘基（题）',
    edition: '公有领域转录（diancang.xyz 本）',
    prefix: 'hjc',
    // 章标题：如「总断千金赋」「01章 天时」「33章 何知章」
    chapterRe: /^(\d{1,2}章\s*[一-龥]{2,12})$/,
    volumeRe: null,
    defaultVolume: '黄金策',
    specialChapters: ['总断千金赋'],
  },
  {
    dir: 'yimao',
    canonicalId: 'yimao.ws.1912',
    book: '易冒',
    author: '程良玉',
    edition: '公有领域转录（diancang.xyz 本）',
    prefix: 'ym',
    // 章标题内嵌于正文，如「甲子章第一」「纳甲章第四」「失物章第八十三」，另有「易冒王序/顾序/自序」
    inlineChapterRe: /(?:[一-龥]{2,10}章第[一二三四五六七八九十百千\d]+|易冒王序|易冒顾序|易冒自序)/g,
    volumeRe: null,
    defaultVolume: '易冒',
  },
];

function splitSentences(text) {
  return text.split(/(?<=[。！？；．])/).map((p) => p.trim()).filter((p) => p.length >= 8 && p.length <= 240);
}

function parseBook(cfg) {
  const src = readFileSync(`data/.kb/books/${cfg.dir}/source.txt`, 'utf8');
  // 内嵌章节模式：直接在连续文本中按标题切分（如《易冒》）
  if (cfg.inlineChapterRe) {
    const parts = src.split(new RegExp(`(?=${cfg.inlineChapterRe.source})`, 'g'));
    const chapters = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const m = trimmed.match(new RegExp(`^(${cfg.inlineChapterRe.source})`));
      const title = m ? m[1] : '卷首';
      const body = m ? trimmed.slice(m[0].length) : trimmed;
      if (title === '卷首' && body.length < 12) continue;
      chapters.push({ title, volume: cfg.defaultVolume, lines: body.split(/\s+/).filter(Boolean) });
    }
    return toCorpus(cfg, chapters);
  }
  const lines = src.split(/\r?\n/);
  const chapters = [];
  let current = null;
  let volume = cfg.defaultVolume;
  for (const raw of lines) {
    const line = raw.trim().replace(/^【|】$/g, '');
    if (!line) continue;
    if (cfg.volumeRe) {
      const vm = cfg.volumeRe.exec(line);
      if (vm) { volume = `卷之${vm[1]}`; continue; }
    }
    const cm = cfg.chapterRe.exec(line);
    const isSpecial = cfg.specialChapters?.includes(line) ?? false;
    if (cm || isSpecial) {
      current = { title: isSpecial ? line : (cm?.[1] ?? line).replace(/^【|】$/g, ''), volume, lines: [] };
      chapters.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return toCorpus(cfg, chapters);
}

function toCorpus(cfg, chapters) {
  // 句级切分
  const corpus = [];
  let seq = 0;
  for (const ch of chapters) {
    const body = ch.lines.join('').replace(/\s+/g, '');
    if (body.length < 12) continue;
    const sentences = splitSentences(body);
    if (sentences.length === 0) continue;
    seq += 1;
    const chapterId = `${cfg.prefix}.c${seq}`;
    for (let i = 0; i < sentences.length; i++) {
      corpus.push({
        segId: `${chapterId}.${i + 1}`,
        text: sentences[i],
        chapter: `${ch.volume}·${ch.title}`,
        book: cfg.book,
        canonicalId: cfg.canonicalId,
        author: cfg.author,
        edition: cfg.edition,
        confidenceLevel: 'A',
        license: '公有领域',
      });
    }
  }
  return corpus;
}

const requested = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = requested.length > 0 ? BOOKS.filter((b) => requested.includes(b.dir)) : BOOKS;

for (const cfg of targets) {
  if (!existsSync(`data/.kb/books/${cfg.dir}/source.txt`)) {
    console.log(`⏭ 跳过 ${cfg.dir}（缺 source.txt）`);
    continue;
  }
  const corpus = parseBook(cfg);
  mkdirSync(`data/.kb/books/${cfg.dir}`, { recursive: true });
  writeFileSync(`data/.kb/books/${cfg.dir}/corpus.jsonl`, corpus.map((c) => JSON.stringify(c)).join('\n'), 'utf-8');
  const tsName = cfg.dir;
  const ts = `/** 内置语料：《${cfg.book}》（${cfg.author}，公有领域转录，章节层级+句级段）——由 scripts/kb-build.mjs 生成，勿手改 */
import type { CorpusSection } from '../retriever.js';

export const ${tsName}Corpus: CorpusSection[] = ${JSON.stringify(corpus)};
`;
  mkdirSync('packages/knowledge/src/corpus', { recursive: true });
  writeFileSync(`packages/knowledge/src/corpus/${tsName}.ts`, ts, 'utf-8');
  console.log(`✓ ${cfg.book}: 段落数 ${corpus.length}`);
  const sample = corpus.slice(0, 2).map((c) => `[${c.chapter}] ${c.text.slice(0, 30)}`).join('\n  ');
  console.log(`  示例: ${sample}`);
}
