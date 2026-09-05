/**
 * LocalCaseStore：基于 localStorage（或任意 KeyValue 后端）的持久化案例本
 * 实现 CaseStore 接口，三壳通用；Web 端接入后刷新/重启不丢数据。
 * 存储键：xuanshu.cases.v1 = JSON 数组（CaseRecord[]）。
 */

import type { ArtType } from '@xuanshu/core';
import type { CaseRecord, FeedbackStats, QuestionRecord } from './schema.js';
import { isDuplicate } from './quota.js';
import { isCaseRecord } from './io.js';
import type { CaseQuery, CaseStore } from './store.js';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CASES_KEY = 'xuanshu.cases.v1';

/** 浏览器 localStorage 的适配（带 try/catch，隐私模式或禁用时降级为空存储） */
export function browserStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      return {
        getItem: (k) => ls.getItem(k),
        setItem: (k, v) => { ls.setItem(k, v); },
        removeItem: (k) => { ls.removeItem(k); },
      };
    }
  } catch {
    /* 隐私模式/禁用 localStorage */
  }
  return memoryStorage();
}

/** 内存存储（Node/测试环境，或浏览器降级） */
export function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

export class LocalCaseStore implements CaseStore {
  private storage: KeyValueStorage;
  private records: Map<string, CaseRecord>;

  constructor(storage: KeyValueStorage = browserStorage()) {
    this.storage = storage;
    this.records = new Map();
    this.hydrate();
  }

  private hydrate(): void {
    try {
      const raw = this.storage.getItem(CASES_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as unknown[];
      if (!Array.isArray(list)) return;
      for (const r of list) {
        if (isCaseRecord(r)) this.records.set(r.caseId, r);
      }
    } catch {
      this.records.clear();
    }
  }

  private commit(next: Map<string, CaseRecord>): void {
    try {
      this.storage.setItem(CASES_KEY, JSON.stringify([...next.values()]));
      this.records = next;
    } catch (error) {
      throw new Error('案例本持久化失败，可能是浏览器存储配额不足或存储已被禁用', { cause: error });
    }
  }

  async add(record: CaseRecord): Promise<void> {
    const next = new Map(this.records);
    next.set(record.caseId, record);
    this.commit(next);
  }

  async update(record: CaseRecord): Promise<void> {
    const next = new Map(this.records);
    next.set(record.caseId, record);
    this.commit(next);
  }

  async get(caseId: string): Promise<CaseRecord | undefined> {
    return this.records.get(caseId);
  }

  async list(query: CaseQuery = {}): Promise<CaseRecord[]> {
    let out = [...this.records.values()];
    if (query.art) out = out.filter((r) => r.artType === query.art);
    if (query.category) out = out.filter((r) => r.question.category === query.category);
    if (query.status) out = out.filter((r) => r.status === query.status);
    if (query.tag) out = out.filter((r) => r.tags.includes(query.tag!) || r.annotation.customTags.includes(query.tag!));
    if (query.text) {
      const q = query.text;
      out = out.filter((r) => r.question.summary.includes(q) || (r.annotation.note ?? '').includes(q));
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async countByArt(art: ArtType): Promise<number> {
    return [...this.records.values()].filter((r) => r.artType === art && r.status !== 'archived').length;
  }

  async remove(caseId: string): Promise<void> {
    const next = new Map(this.records);
    next.delete(caseId);
    this.commit(next);
  }

  async findDuplicate(incoming: { configHash: string; summary: string; createdAt: string }): Promise<CaseRecord | null> {
    for (const r of this.records.values()) {
      if (isDuplicate({ configHash: r.input.configHash, summary: r.question.summary, createdAt: r.createdAt }, incoming)) {
        return r;
      }
    }
    return null;
  }

  async stats(): Promise<FeedbackStats> {
    const byArt: FeedbackStats['byArt'] = {};
    const byCategory: FeedbackStats['byCategory'] = {};
    const byRuleId: Record<string, { shown: number; confirmed: number }> = {};
    for (const r of this.records.values()) {
      const judged = r.annotation.outcome !== undefined;
      const hit = judged && (r.annotation.outcome!.result === '应验' || r.annotation.outcome!.result === '部分应验');
      const art = byArt[r.artType] ?? { total: 0, judged: 0, hit: 0 };
      art.total += 1;
      if (judged) art.judged += 1;
      if (hit) art.hit += 1;
      byArt[r.artType] = art;
      const cat = byCategory[r.question.category] ?? { total: 0, hit: 0 };
      cat.total += 1;
      if (hit) cat.hit += 1;
      byCategory[r.question.category] = cat;
      for (const rh of r.result.ruleHits) {
        const item = byRuleId[rh.ruleId] ?? { shown: 0, confirmed: 0 };
        item.shown += 1;
        if (r.annotation.matchedRuleIds?.includes(rh.ruleId)) item.confirmed += 1;
        byRuleId[rh.ruleId] = item;
      }
    }
    return { byArt, byCategory, byRuleId, computedAt: new Date().toISOString() };
  }

  async incomplete(): Promise<CaseRecord[]> {
    return [...this.records.values()].filter((r) => r.status === 'open' && !r.annotation.updatedAt);
  }
}

export { isDuplicate };
export type { QuestionRecord };
