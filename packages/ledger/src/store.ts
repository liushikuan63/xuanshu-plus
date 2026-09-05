/**
 * 案例存储：事务化写入、崩溃恢复（open 无完成标记）、按 caseId 合并导入
 * 三壳统一走 CaseStore 接口；Dexie 实现置于平台层，本包提供内存实现供测试与无库环境。
 */

import type { ArtType } from '@xuanshu/core';
import type { CaseRecord, FeedbackStats, QuestionRecord } from './schema.js';
import { isDuplicate } from './quota.js';

export interface CaseQuery {
  art?: ArtType;
  category?: string;
  status?: CaseRecord['status'];
  tag?: string;
  text?: string;
}

export interface CaseStore {
  add(record: CaseRecord): Promise<void>;
  update(record: CaseRecord): Promise<void>;
  get(caseId: string): Promise<CaseRecord | undefined>;
  list(query?: CaseQuery): Promise<CaseRecord[]>;
  countByArt(art: ArtType): Promise<number>;
  remove(caseId: string): Promise<void>;
  findDuplicate(incoming: { configHash: string; summary: string; createdAt: string }): Promise<CaseRecord | null>;
  stats(): Promise<FeedbackStats>;
  /** 崩溃恢复：startup 时扫 open 且无 annotation.updatedAt 的未完成条目 */
  incomplete(): Promise<CaseRecord[]>;
}

export class MemoryCaseStore implements CaseStore {
  private records = new Map<string, CaseRecord>();

  async add(record: CaseRecord): Promise<void> {
    this.records.set(record.caseId, record);
  }

  async update(record: CaseRecord): Promise<void> {
    this.records.set(record.caseId, record);
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
    this.records.delete(caseId);
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

export function makeCaseRecord(partial: Partial<CaseRecord> & Pick<CaseRecord, 'artType' | 'question' | 'input' | 'result'>): CaseRecord {
  return {
    caseId: partial.caseId ?? `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    schemaVersion: partial.schemaVersion ?? 1,
    annotation: partial.annotation ?? { presetTags: [], customTags: [], updatedAt: new Date().toISOString() },
    status: partial.status ?? 'open',
    linkedCaseIds: partial.linkedCaseIds ?? [],
    tags: partial.tags ?? [],
    revision: partial.revision ?? 0,
    ...partial,
  };
}

export { isDuplicate };
export type { QuestionRecord };
