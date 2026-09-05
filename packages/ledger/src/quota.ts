/**
 * 每术 99 条配额策略（v5 §5.2）：软提醒、引导归档/导出、不静默删除
 */

import type { ArtType } from '@xuanshu/core';

export interface QuotaConfig {
  /** 每术上限（99 / 199 / Infinity） */
  limit: number;
  /** 软提醒阈值 */
  softThreshold: number;
}

export const DEFAULT_QUOTA: QuotaConfig = { limit: 99, softThreshold: 90 };

export interface QuotaStatus {
  art: ArtType;
  total: number;
  active: number;
  archived: number;
  limit: number;
  softThreshold: number;
  /** 距上限剩余可写条数 */
  remaining: number;
  /** 是否达到软提醒 */
  softReached: boolean;
  /** 是否已满 */
  full: boolean;
  /** 建议动作 */
  suggestion: 'none' | 'archive-oldest' | 'export-backup' | 'raise-limit';
}

export function quotaStatus(
  art: ArtType,
  activeCount: number,
  archivedCount: number,
  cfg: QuotaConfig = DEFAULT_QUOTA,
): QuotaStatus {
  const total = activeCount + archivedCount;
  const remaining = Math.max(0, cfg.limit - activeCount);
  const softReached = activeCount >= cfg.softThreshold;
  const full = activeCount >= cfg.limit;
  let suggestion: QuotaStatus['suggestion'] = 'none';
  if (full) suggestion = 'archive-oldest';
  else if (softReached) suggestion = 'export-backup';
  return {
    art,
    total,
    active: activeCount,
    archived: archivedCount,
    limit: cfg.limit,
    softThreshold: cfg.softThreshold,
    remaining,
    softReached,
    full,
    suggestion,
  };
}

/** 去重判定：同一 configHash + 同一 question.summary + 5 分钟内 → 重复起卦 */
export function isDuplicate(existing: { configHash: string; summary: string; createdAt: string }, incoming: { configHash: string; summary: string; createdAt: string }, windowMs = 5 * 60 * 1000): boolean {
  if (existing.configHash !== incoming.configHash) return false;
  if (existing.summary !== incoming.summary) return false;
  const t1 = new Date(existing.createdAt).getTime();
  const t2 = new Date(incoming.createdAt).getTime();
  return Math.abs(t1 - t2) < windowMs;
}
