/**
 * 可解释 BM25 检索（v5 §8.3）：
 * CJK unigram + bigram 分词；idf = ln(1 + (N - df + 0.5)/(df + 0.5))；k1/b 可调。
 * 同义词只做查询扩展，不做语义替代。
 */

import { normalizeSearchText } from './normalize.js';

export interface TermDoc {
  id: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface Posting {
  docId: string;
  tf: number;
}

export interface Bm25Options {
  k1: number;
  b: number;
}

export const DEFAULT_BM25: Bm25Options = { k1: 1.5, b: 0.75 };

/** CJK unigram + bigram 分词 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const chars = [...normalizeSearchText(text).replace(/\s+/g, '')];
  const isHan = (character: string) => /\p{Script=Han}/u.test(character);
  for (const ch of chars) {
    if (isHan(ch)) tokens.push(ch);
    else if (/[a-zA-Z0-9]/.test(ch)) tokens.push(ch.toLowerCase());
  }
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i]!;
    const b = chars[i + 1]!;
    if (isHan(a) && isHan(b)) tokens.push(a + b);
  }
  return tokens;
}

export class Bm25Index {
  private docs = new Map<string, TermDoc>();
  private postings = new Map<string, Posting[]>();
  private docLen = new Map<string, number>();
  private avgLen = 0;
  private opts: Bm25Options;
  private version = 'bm25-cjk-v2';

  constructor(opts: Bm25Options = DEFAULT_BM25) {
    this.opts = opts;
  }

  add(doc: TermDoc): void {
    if (!doc.id || this.docs.has(doc.id)) {
      throw new Error(`BM25 文档 id 无效或重复: ${doc.id}`);
    }
    this.docs.set(doc.id, doc);
    const terms = tokenize(doc.text);
    this.docLen.set(doc.id, terms.length);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, c] of tf) {
      const list = this.postings.get(t) ?? [];
      list.push({ docId: doc.id, tf: c });
      this.postings.set(t, list);
    }
    let sum = 0;
    for (const l of this.docLen.values()) sum += l;
    this.avgLen = this.docs.size > 0 ? sum / this.docs.size : 0;
  }

  addAll(docs: TermDoc[]): void {
    for (const d of docs) this.add(d);
  }

  get n(): number {
    return this.docs.size;
  }

  search(query: string, topK = 5, synonyms: Record<string, string[]> = {}): Array<{ docId: string; score: number }> {
    const qTerms = new Set<string>();
    for (const t of tokenize(query)) {
      qTerms.add(t);
      for (const syn of synonyms[t] ?? []) qTerms.add(syn);
    }
    const scores = new Map<string, number>();
    const { k1, b } = this.opts;
    const N = this.docs.size;
    for (const term of qTerms) {
      const list = this.postings.get(term);
      if (!list) continue;
      const df = list.length;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (const p of list) {
        const len = this.docLen.get(p.docId) ?? 0;
        const denom = p.tf + k1 * (1 - b + b * (len / Math.max(this.avgLen, 1)));
        const s = idf * ((p.tf * (k1 + 1)) / denom);
        scores.set(p.docId, (scores.get(p.docId) ?? 0) + s);
      }
    }
    return [...scores.entries()]
      .map(([docId, score]) => ({ docId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  getDoc(id: string): TermDoc | undefined {
    return this.docs.get(id);
  }

  /** 导出可序列化快照（IndexedDB 落库用） */
  exportSnapshot(): Bm25Snapshot {
    return {
      version: this.version,
      opts: { ...this.opts },
      avgLen: this.avgLen,
      docs: [...this.docs.entries()].map(([id, d]) => ({ id, text: d.text, meta: d.meta })),
      docLen: [...this.docLen.entries()].map(([id, len]) => [id, len] as const),
      postings: [...this.postings.entries()].map(([t, list]) => [t, list] as const),
    };
  }

  /** 从快照恢复（校验 version/结构，损坏则返回 null 由调用方重建） */
  static fromSnapshot(snap: Bm25Snapshot): Bm25Index | null {
    if (!snap || snap.version !== 'bm25-cjk-v2') return null;
    if (!Array.isArray(snap.docs) || !Array.isArray(snap.docLen) || !Array.isArray(snap.postings)) return null;
    if (!snap.opts || !Number.isFinite(snap.opts.k1) || snap.opts.k1 <= 0 || !Number.isFinite(snap.opts.b) || snap.opts.b < 0 || snap.opts.b > 1) return null;
    if (!Number.isFinite(snap.avgLen) || snap.avgLen < 0) return null;
    const idx = new Bm25Index(snap.opts);
    idx.avgLen = snap.avgLen;
    for (const d of snap.docs) {
      if (!d || typeof d.id !== 'string' || !d.id || typeof d.text !== 'string' || idx.docs.has(d.id)) return null;
      idx.docs.set(d.id, { id: d.id, text: d.text, meta: d.meta });
    }
    for (const entry of snap.docLen) {
      if (!Array.isArray(entry) || entry.length !== 2) return null;
      const [id, len] = entry;
      if (typeof id !== 'string' || !idx.docs.has(id) || idx.docLen.has(id) || typeof len !== 'number' || !Number.isFinite(len) || len < 0) return null;
      idx.docLen.set(id, len);
    }
    if (idx.docLen.size !== idx.docs.size) return null;
    for (const entry of snap.postings) {
      if (!Array.isArray(entry) || entry.length !== 2) return null;
      const [t, list] = entry;
      if (typeof t !== 'string' || !t || !Array.isArray(list) || idx.postings.has(t) || list.length > idx.docs.size) return null;
      const seenDocs = new Set<string>();
      const checked: Posting[] = [];
      for (const posting of list) {
        if (!posting || typeof posting.docId !== 'string' || !idx.docs.has(posting.docId) || seenDocs.has(posting.docId)) return null;
        if (typeof posting.tf !== 'number' || !Number.isFinite(posting.tf) || posting.tf <= 0) return null;
        seenDocs.add(posting.docId);
        checked.push({ docId: posting.docId, tf: posting.tf });
      }
      idx.postings.set(t, checked);
    }
    return idx;
  }
}

export interface Bm25Snapshot {
  version: string;
  opts: Bm25Options;
  avgLen: number;
  docs: Array<{ id: string; text: string; meta?: Record<string, unknown> }>;
  docLen: Array<readonly [string, number]>;
  postings: Array<readonly [string, Posting[]]>;
}

/** 手工术语同义词词典（v5 §8.3，仅查询扩展） */
export const CJK_SYNONYMS: Record<string, string[]> = {
  旬空: ['空亡', '空'],
  月破: ['破'],
  世应: ['世爻', '应爻'],
  飞伏: ['伏神', '飞神'],
  三传: ['初传', '中传', '末传'],
  四课: ['课体'],
  进退神: ['化进', '化退'],
  体用: ['体卦', '用卦'],
  用神: ['用爻'],
  财: ['妻财', '财爻'],
  官: ['官鬼', '官爻'],
  父母: ['文书', '印'],
  子孙: ['福神'],
};
