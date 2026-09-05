import { describe, expect, it } from 'vitest';
import { Bm25Index, tokenize, CJK_SYNONYMS } from './bm25.js';
import { foldVariants, includesNormalizedText, normalizeSearchText } from './normalize.js';
import { Retriever, CATEGORY_EXPANSION, enrichRuleCitations } from './retriever.js';
import { builtinZhouyiCorpus, builtinCorpus, builtinStats } from './builtin.js';
import { corpusHashOf, buildBuiltinSnapshot, MemoryKnowledgeStore, loadBuiltinKnowledge } from './persist.js';
import type { RuleHit } from '@xuanshu/core';

describe('CJK 分词', () => {
  it('unigram + bigram', () => {
    const tokens = tokenize('用神旺相');
    expect(tokens).toContain('用');
    expect(tokens).toContain('用神');
    expect(tokens).toContain('旺');
    expect(tokens).toContain('旺相');
  });

  it('统一异体字、繁简字并识别扩展汉字', () => {
    expect(foldVariants('㐫髙淂𡈽')).toBe('凶高得土');
    expect(foldVariants('𠩄𣴑𤣥𤼵𦲞𨶚𩔖')).toBe('所流玄發老遂類');
    expect(normalizeSearchText('妻財陰陽變卦')).toBe('妻财阴阳变卦');
    expect(tokenize('𡈽旺')).toEqual(expect.arrayContaining(['土', '土旺']));
    expect(includesNormalizedText('陰陽動靜，變化無窮', '阴阳动静')).toBe(true);
  });
});

describe('BM25', () => {
  it('命中相关段落', () => {
    const idx = new Bm25Index();
    idx.addAll([
      { id: 's1', text: '用神旺相，不空不破，失物可寻' },
      { id: 's2', text: '官鬼旺动，主蓄意偷窃' },
      { id: 's3', text: '梅花易数以体用生克断吉凶' },
    ]);
    const r = idx.search('失物 用神', 3);
    expect(r[0]!.docId).toBe('s1');
  });

  it('同义词扩展', () => {
    const idx = new Bm25Index();
    idx.addAll([
      { id: 's1', text: '妻财爻为财物之用神' },
      { id: 's2', text: '求财问事业' },
    ]);
    const r = idx.search('财', 2, CJK_SYNONYMS);
    expect(r[0]!.docId).toBe('s1');
  });

  it('拒绝重复文档 id，避免倒排索引与文档表失配', () => {
    const idx = new Bm25Index();
    idx.add({ id: 's1', text: '用神旺相' });
    expect(() => idx.add({ id: 's1', text: '用神衰弱' })).toThrow('BM25 文档 id 无效或重复');
  });

  it('简体查询可命中繁体索引正文', () => {
    const idx = new Bm25Index();
    idx.addAll([
      { id: 'traditional', text: '妻財爻逢旬空，陰陽動靜。' },
      { id: 'other', text: '官鬼旺动，世应相克。' },
    ]);
    expect(idx.search('妻财', 1)[0]?.docId).toBe('traditional');
    expect(idx.search('阴阳', 1)[0]?.docId).toBe('traditional');
  });
});

describe('Retriever', () => {
  it('事项联动扩展', () => {
    const r = new Retriever([
      { segId: 'a1', text: '妻财爻旺相，求财可成', canonicalId: 'b1', book: '增删卜易', chapter: '求财章', confidenceLevel: 'A' },
      { segId: 'a2', text: '用神旬空，诸事难成', canonicalId: 'b1', book: '增删卜易', chapter: '空亡章', confidenceLevel: 'A' },
    ]);
    const hits = r.search('讨债', { category: '求财', topK: 2 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.citation.canonicalId).toBe('b1');
    expect(CATEGORY_EXPANSION['求财']).toContain('妻财');
  });
});

describe('内置知识库（《周易》448 段）', () => {
  it('规模：64 卦 × (卦辞 + 6 爻辞) = 448 段', () => {
    const corpus = builtinZhouyiCorpus();
    expect(corpus.length).toBe(448);
    const stats = builtinStats();
    expect(stats.books).toContain('周易');
  });

  it('搜索命中卦辞', () => {
    const kb = new Retriever(builtinZhouyiCorpus());
    const hits = kb.search('乾 元亨利贞', { topK: 3 });
    expect(hits[0]!.section.segId).toBe('zhouyi.乾为天.guaci');
  });

  it('断语引用回链：补 charRange 并校验原文', () => {
    const kb = new Retriever(builtinZhouyiCorpus());
    const rules: RuleHit[] = [
      {
        ruleId: 'liuyao.ben.guaci',
        text: '本卦卦辞',
        severity: '提示',
        confidenceLevel: 'A',
        citations: [{
          canonicalId: 'zhouyi.guaci', book: '周易', edition: '通行本', chapter: '乾为天·卦辞',
          segId: 'zhouyi.乾为天.guaci', quote: '元亨利贞。', license: '公有领域', confidenceLevel: 'A',
        }],
      },
      {
        ruleId: 'liuyao.unknown',
        text: '无法回链',
        severity: '提示',
        confidenceLevel: 'D',
        citations: [{
          canonicalId: 'x', book: '某书', edition: 'e', chapter: 'c', segId: 'missing', quote: 'q', license: '公有领域', confidenceLevel: 'D',
        }],
      },
    ];
    const enriched = enrichRuleCitations(rules, kb);
    expect(enriched[0]!.citations[0]!.charRange).toEqual([0, 5]);
    expect(enriched[0]!.citations[0]!.transcriptionConfidence).toBe(0.99);
    expect(enriched[1]!.citations[0]!.charRange).toBeUndefined();
  });
});

describe('内置知识库扩展（含参考工程语料库采纳）', () => {
  it('全量内置：周易448 + 增删3565 + 卜筮2076 + 黄金策3579 + 易冒3349 + 采纳1183 = 14200 段', () => {
    const corpus = builtinCorpus();
    expect(corpus.length).toBe(14200);
    const stats = builtinStats();
    expect(stats.books).toEqual(expect.arrayContaining(['周易', '增删卜易', '卜筮正宗', '黄金策', '易冒']));
    expect(stats.segments).toBe(14200);
  });

  it('《增删卜易》章节层级保留', () => {
    const corpus = builtinCorpus();
    const zsby = corpus.filter((c) => c.book === '增删卜易');
    expect(zsby.length).toBe(3565);
    expect(zsby.every((c) => c.chapter?.startsWith('卷'))).toBe(true);
    const xk = zsby.filter((c) => c.chapter?.includes('旬空'));
    expect(xk.length).toBeGreaterThan(0);
  });

  it('《卜筮正宗》含月破论/旬空论/用神分类定例', () => {
    const corpus = builtinCorpus();
    const bsz = corpus.filter((c) => c.book === '卜筮正宗');
    expect(bsz.length).toBe(2076);
    const chapters = new Set(bsz.map((c) => c.chapter));
    expect([...chapters].some((c) => c?.includes('月破论'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('旬空论'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('用神分类定例'))).toBe(true);
  });

  it('《黄金策》含总断千金赋与分类占断章', () => {
    const corpus = builtinCorpus();
    const hjc = corpus.filter((c) => c.book === '黄金策');
    expect(hjc.length).toBe(3579);
    const chapters = new Set(hjc.map((c) => c.chapter));
    expect([...chapters].some((c) => c?.includes('总断千金赋'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('天时'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('求财'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('病症'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('婚姻'))).toBe(true);
  });

  it('《易冒》含 83 章与序言', () => {
    const corpus = builtinCorpus();
    const ym = corpus.filter((c) => c.book === '易冒');
    expect(ym.length).toBe(3349);
    const chapters = new Set(ym.map((c) => c.chapter));
    expect([...chapters].some((c) => c?.includes('易冒王序'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('易冒自序'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('甲子章第一'))).toBe(true);
    expect([...chapters].some((c) => c?.includes('失物章第八十三'))).toBe(true);
  });

  it('旬空/月破规则引用回链到《增删卜易》原文', () => {
    const kb = new Retriever(builtinCorpus());
    const rules: RuleHit[] = [
      { ruleId: 'liuyao.xunkong', text: '旬空', severity: '变数', confidenceLevel: 'A', citations: [{ canonicalId: 'zengshanbuyi.ws.1912', book: '增删卜易', author: '野鹤老人', edition: '公有领域转录', chapter: 'zsby.c31', segId: 'zsby.c31.2', quote: '如甲子至癸酉日为一旬，此十日之内，并无戌亥，以爻逢戌亥为空亡，又名旬空，馀仿此。', license: '公有领域', confidenceLevel: 'A' }] },
      { ruleId: 'liuyao.yuepo', text: '月破', severity: '凶', confidenceLevel: 'A', citations: [{ canonicalId: 'zengshanbuyi.ws.1912', book: '增删卜易', edition: '公有领域转录', chapter: 'zsby.c36', segId: 'zsby.c36.1', quote: '正申、二酉、三戌，四亥、五子、六丑、七寅、八卯、九辰，十巳、十一午、十二未，月建冲之为月破，逐月之破日是也。', license: '公有领域', confidenceLevel: 'A' }] },
    ];
    const enriched = enrichRuleCitations(rules, kb);
    for (const r of enriched) {
      const cr = r.citations[0]!.charRange!;
      expect(cr[0]).toBe(0);
      expect(cr[1] - cr[0]).toBe(r.citations[0]!.quote.length);
    }
  });

  it('搜索命中《卜筮正宗》月破论', () => {
    const kb = new Retriever(builtinCorpus());
    const hits = kb.search('月破 最喜逢合填实', { topK: 3 });
    expect(hits.some((h) => h.citation.canonicalId === 'bushizhengzong.ws.1912')).toBe(true);
  });

  it('搜索命中《增删卜易》章节', () => {
    const kb = new Retriever(builtinCorpus());
    const hits = kb.search('旬空 何谓', { topK: 3 });
    expect(hits.some((h) => h.citation.canonicalId === 'zengshanbuyi.ws.1912')).toBe(true);
  });

  it('搜索命中《黄金策》总断千金赋与《易冒》章句', () => {
    const kb = new Retriever(builtinCorpus());
    const hjcHits = kb.search('动静阴阳 反复变迁 太过者损之斯成', { topK: 5 });
    expect(hjcHits.some((h) => h.citation.canonicalId === 'huangjince.ws.1912')).toBe(true);
    const ymHits = kb.search('浑天甲子 乾坤为天地 纳甲', { topK: 5 });
    expect(ymHits.some((h) => h.citation.canonicalId === 'yimao.ws.1912')).toBe(true);
  });
});

describe('知识库持久化（IndexedDB 落库）', () => {
  it('Bm25 快照 roundtrip：序列化→恢复→检索结果一致', () => {
    const idx = new Bm25Index();
    idx.addAll([
      { id: 's1', text: '用神旺相，不空不破，失物可寻' },
      { id: 's2', text: '官鬼旺动，主蓄意偷窃' },
      { id: 's3', text: '梅花易数以体用生克断吉凶' },
    ]);
    const snap = idx.exportSnapshot();
    const restored = Bm25Index.fromSnapshot(JSON.parse(JSON.stringify(snap)))!;
    const a = idx.search('失物 用神', 3);
    const b = restored.search('失物 用神', 3);
    expect(b.map((r) => r.docId)).toEqual(a.map((r) => r.docId));
    expect(b[0]!.score).toBeCloseTo(a[0]!.score, 6);
  });

  it('拒绝旧版分词快照，避免复用未归一化的索引', () => {
    const idx = new Bm25Index();
    idx.add({ id: 's1', text: '陰陽動靜' });
    const snapshot = idx.exportSnapshot();
    snapshot.version = 'bm25-cjk-v1';
    expect(Bm25Index.fromSnapshot(snapshot)).toBeNull();
  });

  it('Retriever 快照 roundtrip：内置语料恢复后可检索', () => {
    const kb = new Retriever(builtinCorpus());
    const snap = kb.exportSnapshot();
    const restored = Retriever.fromSnapshot(JSON.parse(JSON.stringify(snap)))!;
    expect(restored.size).toBe(14200);
    const hits = restored.search('旬空 何谓', { topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('拒绝引用未知文档的损坏 BM25 posting', () => {
    const idx = new Bm25Index();
    idx.add({ id: 's1', text: '用神旺相' });
    const snap = idx.exportSnapshot();
    snap.postings[0]![1][0] = { docId: 'missing', tf: 1 };
    expect(Bm25Index.fromSnapshot(snap)).toBeNull();
  });

  it('拒绝重复 segId 的 Retriever 语料', () => {
    expect(() => new Retriever([
      { segId: 's1', text: '用神旺相' },
      { segId: 's1', text: '用神衰弱' },
    ])).toThrow('BM25 文档 id 无效或重复');
  });

  it('corpusHash 确定性且随语料变化', () => {
    const a = builtinCorpus();
    const h1 = corpusHashOf(a);
    const h2 = corpusHashOf(builtinCorpus());
    expect(h1).toBe(h2);
    const changed = [...a.slice(0, -1), { ...a[a.length - 1]!, text: a[a.length - 1]!.text + '。' }];
    expect(corpusHashOf(changed)).not.toBe(h1);
    const sameLength = [...a.slice(0, -1), { ...a[a.length - 1]!, text: a[a.length - 1]!.text.replace(/^./u, '异') }];
    expect(sameLength.at(-1)!.text.length).toBe(a.at(-1)!.text.length);
    expect(corpusHashOf(sameLength)).not.toBe(h1);
  });

  it('MemoryKnowledgeStore：写入→重载→命中缓存，且检索与重建一致', async () => {
    const store = new MemoryKnowledgeStore();
    const first = await loadBuiltinKnowledge(store);
    expect(first.loadedFromCache).toBe(false);
    expect(first.kb.size).toBe(14200);
    const second = await loadBuiltinKnowledge(store);
    expect(second.loadedFromCache).toBe(true);
    expect(second.kb.size).toBe(14200);
    const q = '月破 月建冲之';
    const a = first.kb.search(q, { topK: 3 });
    const b = second.kb.search(q, { topK: 3 });
    expect(b.map((r) => r.citation.segId)).toEqual(a.map((r) => r.citation.segId));
  });

  it('版本不符（语料哈希变化）→ 自动重建并覆盖', async () => {
    const store = new MemoryKnowledgeStore();
    await loadBuiltinKnowledge(store);
    const meta = await store.getMeta();
    expect(meta!.segments).toBe(14200);
    // 篡改存储快照模拟旧版本
    const fresh = buildBuiltinSnapshot();
    const tampered = Retriever.fromSnapshot(fresh.snapshot)!.exportSnapshot();
    tampered.sections = tampered.sections.slice(0, 100);
    await store.put({ ...fresh.meta, corpusHash: 'fnv1a_00000000', segments: 100 }, tampered);
    const reloaded = await loadBuiltinKnowledge(store);
    expect(reloaded.loadedFromCache).toBe(false);
    expect(reloaded.kb.size).toBe(14200);
  });

  it('损坏快照（非法 JSON 结构）→ 安全重建', async () => {
    const store = new MemoryKnowledgeStore();
    const fresh = buildBuiltinSnapshot();
    await store.put(fresh.meta, { version: 'retriever-v1', sections: [], index: {} as never });
    const r = await loadBuiltinKnowledge(store);
    expect(r.loadedFromCache).toBe(false);
    expect(r.kb.size).toBe(14200);
  });

  it('元数据未变但快照正文被篡改 → 安全重建', async () => {
    const sections = [
      { segId: 's1', text: '用神旺相', book: '测试书' },
      { segId: 's2', text: '世应相生', book: '测试书' },
    ];
    const store = new MemoryKnowledgeStore();
    const fresh = buildBuiltinSnapshot(sections);
    fresh.snapshot.sections[0] = { ...fresh.snapshot.sections[0]!, text: '用神衰弱' };
    await store.put(fresh.meta, fresh.snapshot);
    const restored = await loadBuiltinKnowledge(store, sections);
    expect(restored.loadedFromCache).toBe(false);
    expect(restored.kb.findBySegId('s1')?.text).toBe('用神旺相');
  });
});
