/**
 * 案例本数据模型（v5 §5.1）
 */

import type { ArtType, CategoryId, CitationRef, SubCategoryId } from '@xuanshu/core';

export interface QuestionRecord {
  category: CategoryId;
  subCategory?: SubCategoryId;
  text?: string;
  structured: {
    who?: string;
    what?: string;
    timeRange?: string;
    options?: string[];
    location?: string;
    needTiming?: boolean;
  };
  summary: string;
}

export interface InputSnapshot {
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  config: Record<string, unknown>;
  configHash: string;
  engineVersion: string;
}

export interface ResultSnapshot {
  chart: Record<string, unknown>;
  ruleHits: Array<{ ruleId: string; text: string; confidenceLevel: string; citations?: CitationRef[] }>;
  warnings: Array<{ code: string; message: string; level: string }>;
  evidenceRefs: CitationRef[];
  boardHash: string;
}

export interface UserAnnotation {
  presetTags: Array<'应验' | '部分应验' | '未应验' | '存疑' | '重要'>;
  customTags: string[];
  outcome?: { result: '应验' | '部分应验' | '未应验' | '无法判断'; at: string; note?: string };
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
  keyTakeaway?: string;
  matchedRuleIds?: string[];
  updatedAt: string;
}

export interface CaseRecord {
  caseId: string;
  artType: ArtType;
  createdAt: string;
  schemaVersion: number;
  question: QuestionRecord;
  input: InputSnapshot;
  result: ResultSnapshot;
  interpretation?: {
    provider: string;
    model: string;
    promptHash: string;
    cards: Array<{ claimId: string; text: string; evidenceIds: string[]; confidence: number }>;
    retrievedIds: string[];
    coverageScore: number;
    createdAt: string;
  };
  annotation: UserAnnotation;
  status: 'open' | 'resolved' | 'archived';
  remindAt?: string;
  linkedCaseIds: string[];
  tags: string[];
  revision: number;
}

export interface FeedbackStats {
  byArt: Partial<Record<ArtType, { total: number; judged: number; hit: number }>>;
  byCategory: Partial<Record<CategoryId, { total: number; hit: number }>>;
  byRuleId: Record<string, { shown: number; confirmed: number }>;
  computedAt: string;
}

export const SCHEMA_VERSION = 1;

export function newCaseId(): string {
  const t = Date.now();
  return `case_${t.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
