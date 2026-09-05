/**
 * Retriever：BM25 + 事项联动 + playbook 联动（v5 §8.3）
 * 输出带 CitationRef 的命中，供 answer.composer 使用。
 */

import type { CategoryId, CitationRef } from '@xuanshu/core';
import { Bm25Index, CJK_SYNONYMS, type Bm25Snapshot } from './bm25.js';

export interface CorpusSection {
  segId: string;
  /** 真实校准文字（默认展示与检索基准；导入时即校对定本） */
  text: string;
  normalizedText?: string;
  chapter?: string;
  book?: string;
  canonicalId?: string;
  author?: string;
  edition?: string;
  confidenceLevel?: 'A' | 'B' | 'C' | 'D' | 'E';
  license?: '公有领域' | '用户自有' | '未知';
  /** 扫描文：OCR 直出未经校对（若有则可在典籍阅读中切换显示；无则回退 text） */
  scanText?: string;
  /** 注释文：带注释版本（若有；无则回退 text） */
  notes?: string;
  /** 白话文：现代白话翻译（若有；无则回退 text） */
  plain?: string;
}

/** 事项 → 查询扩展词（v5 §8.3 事项联动） */
export const CATEGORY_EXPANSION: Record<CategoryId, string[]> = {
  求财: ['财爻', '妻财', '子孙', '求财', '谋财'],
  事业: ['官鬼', '功名', '文书', '职位'],
  感情: ['世应', '妻财', '官鬼', '婚姻'],
  学业: ['文书', '印', '文昌'],
  健康: ['用神', '疾病'],
  出行: ['出行', '驿马'],
  官非: ['官鬼', '诉讼'],
  失物: ['失物', '妻财', '父母', '用神'],
  择日: ['择日', '方位'],
  家宅: ['家宅', '父母'],
  生育: ['子孙'],
  合作: ['兄弟', '合作'],
  决策: ['应期'],
  其他: [],
};

export interface RetrieveOptions {
  topK?: number;
  category?: CategoryId;
  playbookKeywords?: string[];
}

export class Retriever {
  private index = new Bm25Index();

  constructor(private sections: CorpusSection[] = []) {
    this.sections = [...sections];
    this.index.addAll(this.sections.map((s) => ({ id: s.segId, text: s.normalizedText ?? s.text })));
  }

  add(section: CorpusSection): void {
    this.sections.push(section);
    this.index.add({ id: section.segId, text: section.normalizedText ?? section.text });
  }

  search(query: string, opts: RetrieveOptions = {}): Array<{ section: CorpusSection; score: number; citation: CitationRef }> {
    const expanded = [query, ...(opts.category ? CATEGORY_EXPANSION[opts.category] ?? [] : []), ...(opts.playbookKeywords ?? [])].join(' ');
    const top = this.index.search(expanded, opts.topK ?? 5, CJK_SYNONYMS);
    return top.map((t) => {
      const raw = this.index.getDoc(t.docId)!;
      const section = this.sections.find((s) => s.segId === raw.id)!;
      return {
        section,
        score: t.score,
        citation: toCitation(section),
      };
    });
  }

  /** 按 segId 定位段落（L1 引用校验与断语回链用） */
  findBySegId(segId: string): CorpusSection | undefined {
    return this.sections.find((s) => s.segId === segId);
  }

  get size(): number {
    return this.sections.length;
  }

  /** 导出可序列化快照（IndexedDB 落库用）：语料 + BM25 索引 */
  exportSnapshot(): RetrieverSnapshot {
    return {
      version: 'retriever-v1',
      sections: this.sections,
      index: this.index.exportSnapshot(),
    };
  }

  /** 从快照恢复；损坏或版本不符返回 null（由调用方重建索引） */
  static fromSnapshot(snap: RetrieverSnapshot): Retriever | null {
    if (!snap || snap.version !== 'retriever-v1') return null;
    if (!Array.isArray(snap.sections)) return null;
    const index = Bm25Index.fromSnapshot(snap.index);
    if (!index) return null;
    if (index.n !== snap.sections.length) return null;
    const ids = new Set<string>();
    for (const section of snap.sections) {
      if (!section || typeof section.segId !== 'string' || typeof section.text !== 'string' || ids.has(section.segId)) return null;
      ids.add(section.segId);
      const indexed = index.getDoc(section.segId);
      if (!indexed || indexed.text !== (section.normalizedText ?? section.text)) return null;
    }
    const kb = new Retriever();
    kb.index = index;
    kb.sections = [...snap.sections];
    return kb;
  }
}

export interface RetrieverSnapshot {
  version: 'retriever-v1';
  sections: CorpusSection[];
  index: Bm25Snapshot;
}

/**
 * 断语引用回链：按 segId 在知识库定位原文，校验引文并补 charRange。
 * 未命中的引用保持原样（由 UI 显示「请导入书库」缺口）。
 */
export function enrichRuleCitations<T extends { citations: CitationRef[] }>(rules: T[], kb: Retriever): T[] {
  return rules.map((r) => ({
    ...r,
    citations: r.citations.map((c) => {
      const seg = kb.findBySegId(c.segId);
      if (!seg) return c;
      const idx = seg.text.indexOf(c.quote);
      const charRange: [number, number] | undefined = idx >= 0 ? [idx, idx + c.quote.length] : undefined;
      return {
        ...c,
        charRange,
        quote: charRange ? seg.text.slice(charRange[0], charRange[1]) : c.quote,
        transcriptionConfidence: 0.99,
      };
    }),
  }));
}

export function toCitation(s: CorpusSection): CitationRef {
  return {
    canonicalId: s.canonicalId ?? 'user-owned',
    book: s.book ?? '用户自有书库',
    edition: '用户导入',
    chapter: s.chapter ?? '',
    segId: s.segId,
    quote: s.text.slice(0, 60),
    license: s.license ?? '用户自有',
    confidenceLevel: s.confidenceLevel ?? 'D',
  };
}
