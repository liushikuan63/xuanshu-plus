/**
 * 知识库持久化（v5 §17.3 / v8 §8）：语料 + BM25 索引落库 IndexedDB
 *  - Web 端启动优先从 IndexedDB 恢复快照，避免重复构建 BM25 索引；
 *  - 版本不符（corpusHash 变化）或损坏时自动重建并写回；
 *  - 三壳统一走 KnowledgeStore 接口（浏览器 IndexedDB / Node 内存）。
 */

import type { CorpusSection, RetrieverSnapshot } from './retriever.js';
import { Retriever } from './retriever.js';
import { builtinCorpus } from './builtin.js';

/** 存储键（库名/表名/键） */
export const DB_NAME = 'xuanshu-knowledge';
export const DB_VERSION = 1;
export const STORE_META = 'meta';
export const STORE_SNAPSHOT = 'snapshot';

export interface KnowledgeMeta {
  schemaVersion: number;
  corpusHash: string;
  segments: number;
  books: string[];
  writtenAt: string;
  retrieverVersion: string;
}

export interface KnowledgeStore {
  getMeta(): Promise<KnowledgeMeta | undefined>;
  getSnapshot(): Promise<RetrieverSnapshot | undefined>;
  put(meta: KnowledgeMeta, snapshot: RetrieverSnapshot): Promise<void>;
  clear(): Promise<void>;
}

/** 对内置语料生成确定性哈希：语料变化时 IndexedDB 快照自动失效 */
export function corpusHashOf(sections: CorpusSection[]): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  feed(`v2|${sections.length}|`);
  for (const s of sections) {
    feed(JSON.stringify([
      s.segId,
      s.text,
      s.normalizedText ?? '',
      s.chapter ?? '',
      s.book ?? '',
      s.canonicalId ?? '',
      s.author ?? '',
      s.edition ?? '',
      s.confidenceLevel ?? '',
      s.license ?? '',
      s.scanText ?? '',
      s.notes ?? '',
      s.plain ?? '',
    ]));
  }
  return 'fnv1a_' + h.toString(16).padStart(8, '0');
}

function builtinMetaOf(sections: CorpusSection[]): KnowledgeMeta {
  return {
    schemaVersion: 1,
    corpusHash: corpusHashOf(sections),
    segments: sections.length,
    books: [...new Set(sections.map((s) => s.book).filter((b): b is string => !!b))],
    writtenAt: new Date().toISOString(),
    retrieverVersion: 'retriever-v1',
  };
}

/** 构建内置语料快照与元数据（重建用） */
export function buildBuiltinSnapshot(sections: CorpusSection[] = builtinCorpus()): { meta: KnowledgeMeta; snapshot: RetrieverSnapshot } {
  const kb = new Retriever(sections);
  return {
    meta: builtinMetaOf(sections),
    snapshot: kb.exportSnapshot(),
  };
}

/** 浏览器 IndexedDB 实现（隐私模式/不可用时降级为空存储） */
export class IndexedDbKnowledgeStore implements KnowledgeStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private open(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
          if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) db.createObjectStore(STORE_SNAPSHOT);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  private tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    return this.open().then((db) => {
      if (!db) return undefined;
      return new Promise((resolve, reject) => {
        try {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e as Error);
        }
      });
    });
  }

  async getMeta(): Promise<KnowledgeMeta | undefined> {
    return this.tx(STORE_META, 'readonly', (s) => s.get('meta'));
  }

  async getSnapshot(): Promise<RetrieverSnapshot | undefined> {
    return this.tx(STORE_SNAPSHOT, 'readonly', (s) => s.get('snapshot'));
  }

  async put(meta: KnowledgeMeta, snapshot: RetrieverSnapshot): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      try {
        const t = db.transaction([STORE_META, STORE_SNAPSHOT], 'readwrite');
        t.objectStore(STORE_META).put(meta, 'meta');
        t.objectStore(STORE_SNAPSHOT).put(snapshot, 'snapshot');
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await Promise.all(
      [STORE_META, STORE_SNAPSHOT].map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            try {
              const t = db.transaction(s, 'readwrite');
              t.objectStore(s).clear();
              t.oncomplete = () => resolve();
              t.onerror = () => reject(t.error);
            } catch (e) {
              reject(e as Error);
            }
          }),
      ),
    );
  }
}

/** 内存实现（Node/测试，或浏览器 IndexedDB 不可用时降级） */
export class MemoryKnowledgeStore implements KnowledgeStore {
  private meta?: KnowledgeMeta;
  private snapshot?: RetrieverSnapshot;
  constructor() {
    this.meta = undefined;
    this.snapshot = undefined;
  }
  async getMeta(): Promise<KnowledgeMeta | undefined> {
    return this.meta;
  }
  async getSnapshot(): Promise<RetrieverSnapshot | undefined> {
    return this.snapshot;
  }
  async put(meta: KnowledgeMeta, snapshot: RetrieverSnapshot): Promise<void> {
    this.meta = meta;
    this.snapshot = snapshot;
  }
  async clear(): Promise<void> {
    this.meta = undefined;
    this.snapshot = undefined;
  }
}

/** 浏览器端优先 IndexedDB，不可用时降级内存 */
export function browserKnowledgeStore(): KnowledgeStore {
  try {
    if (typeof indexedDB !== 'undefined') return new IndexedDbKnowledgeStore();
  } catch {
    /* 不可用 */
  }
  return new MemoryKnowledgeStore();
}

/**
 * 加载内置知识库：
 *  1) 从存储读取快照，版本匹配且结构完整 → 直接恢复（免重建索引）；
 *  2) 否则用 builtinCorpus() 重建并写回存储。
 * 返回 { kb, loadedFromCache }，调用方自行 new Retriever 或直接使用快照。
 */
export async function loadBuiltinKnowledge(store: KnowledgeStore, sections: CorpusSection[] = builtinCorpus()): Promise<{ kb: Retriever; loadedFromCache: boolean }> {
  const expectedMeta = builtinMetaOf(sections);
  try {
    const meta = await store.getMeta();
    const snap = await store.getSnapshot();
    if (
      meta
      && snap
      && meta.schemaVersion === expectedMeta.schemaVersion
      && meta.retrieverVersion === expectedMeta.retrieverVersion
      && meta.segments === expectedMeta.segments
      && meta.corpusHash === expectedMeta.corpusHash
      && corpusHashOf(snap.sections) === expectedMeta.corpusHash
    ) {
        const kb = Retriever.fromSnapshot(snap);
        if (kb) return { kb, loadedFromCache: true };
    }
  } catch {
    /* 存储读取失败走重建 */
  }
  const kb = new Retriever(sections);
  const snapshot = kb.exportSnapshot();
  try {
    await store.put(expectedMeta, snapshot);
  } catch {
    /* 写库失败不影响内存使用 */
  }
  return { kb, loadedFromCache: false };
}

export { builtinCorpus };
