/**
 * 引用模型校验（v5 §9.1/§9.8 verify-citation）
 */

import type { CitationRef } from '@xuanshu/core';

export interface CitationCheckResult {
  ok: boolean;
  issues: string[];
  degraded: boolean;
}

export function validateCitation(c: CitationRef): CitationCheckResult {
  const issues: string[] = [];
  if (!c.canonicalId) issues.push('缺 canonicalId');
  if (!c.book) issues.push('缺 book');
  if (!c.chapter) issues.push('缺 chapter');
  if (!c.segId) issues.push('缺 segId');
  if (!c.quote) issues.push('缺 quote');
  if (!['A', 'B', 'C', 'D', 'E'].includes(c.confidenceLevel)) issues.push(`非法 confidenceLevel: ${c.confidenceLevel}`);
  let degraded = false;
  if (c.segId.startsWith('pending:')) {
    degraded = true;
    issues.push('segId 为 pending（待语料核验）');
  }
  return { ok: issues.length === 0, issues, degraded };
}

/** charRange 校验：不越界、引文与原文一致（允许异体字差异 → 记录告警） */
export function verifyCharRange(c: CitationRef, segmentText: string): CitationCheckResult {
  const base = validateCitation(c);
  const issues = [...base.issues];
  if (c.charRange) {
    const [start, end] = c.charRange;
    if (start < 0 || end > segmentText.length || start >= end) {
      issues.push(`charRange 越界 [${start}, ${end}]，段长 ${segmentText.length}`);
    } else {
      const actual = segmentText.slice(start, end);
      if (!actual.includes(c.quote.slice(0, Math.min(6, c.quote.length)))) {
        issues.push('引文与原文不一致（允许异体字差异）');
      }
    }
  }
  return { ok: issues.length === 0, issues, degraded: base.degraded };
}
