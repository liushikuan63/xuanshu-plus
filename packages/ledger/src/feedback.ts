/**
 * 本地闭环统计（v5 §5.4）：只校准用户自己的解释习惯，绝不回写排盘层
 */

import type { CaseRecord, FeedbackStats, UserAnnotation } from './schema.js';
import { artLabel } from '@xuanshu/core';

const MIN_SAMPLE = 20;

export type OutcomeResult = '应验' | '部分应验' | '未应验' | '无法判断';

export interface OutcomeInput {
  result: OutcomeResult;
  /** 实际应验时间；缺省用当前时间 */
  at?: string;
  note?: string;
  /** 命中且确认有效的规则 id（用于 byRuleId 校准） */
  matchedRuleIds?: string[];
  keyTakeaway?: string;
}

/**
 * 纯函数：给某条案例回标事后应验结果，返回更新后的新记录（不改原对象）。
 * 应验/部分应验/未应验 → 状态置为 resolved；无法判断 → 保持原状态（仍待回标）。
 */
export function applyOutcome(record: CaseRecord, input: OutcomeInput): CaseRecord {
  const now = new Date().toISOString();
  const tag = input.result === '无法判断' ? '存疑' : input.result;
  const exclusionTags = ['应验', '部分应验', '未应验', '存疑'] as const;
  const presetTags: UserAnnotation['presetTags'] = [
    tag,
    ...(record.annotation.presetTags ?? []).filter(
      (t) => !exclusionTags.includes(t as (typeof exclusionTags)[number]),
    ),
  ].slice(0, 5) as UserAnnotation['presetTags'];
  return {
    ...record,
    revision: (record.revision ?? 0) + 1,
    status: input.result === '无法判断' ? record.status : 'resolved',
    annotation: {
      ...record.annotation,
      presetTags,
      customTags: record.annotation.customTags ?? [],
      outcome: { result: input.result, at: input.at ?? now, note: input.note },
      matchedRuleIds: input.matchedRuleIds ?? record.annotation.matchedRuleIds,
      keyTakeaway: input.keyTakeaway ?? record.annotation.keyTakeaway,
      updatedAt: now,
    },
  };
}

export interface CalibrationInsight {
  dimension: 'art' | 'category' | 'rule';
  key: string;
  total: number;
  hitRate: number;
  sampleEnough: boolean;
  message: string;
}

/** 生成个人校准提示（样本 <20 条显式标注） */
export function calibrate(records: CaseRecord[], stats: FeedbackStats): CalibrationInsight[] {
  const out: CalibrationInsight[] = [];
  for (const [art, s] of Object.entries(stats.byArt)) {
    if (!s || s.total === 0) continue;
    const rate = s.judged > 0 ? s.hit / s.judged : 0;
    out.push({
      dimension: 'art',
      key: art,
      total: s.judged,
      hitRate: rate,
      sampleEnough: s.judged >= MIN_SAMPLE,
      message: sampleMessage(`「${artLabel(art)}」`, s.judged, rate),
    });
  }
  for (const [cat, s] of Object.entries(stats.byCategory)) {
    if (!s || s.total < 5) continue;
    const rate = s.total > 0 ? s.hit / s.total : 0;
    out.push({
      dimension: 'category',
      key: cat,
      total: s.total,
      hitRate: rate,
      sampleEnough: s.total >= MIN_SAMPLE,
      message: sampleMessage(`「${cat}」事项`, s.total, rate),
    });
  }
  return out;
}

function sampleMessage(label: string, n: number, rate: number): string {
  const pct = Math.round(rate * 100);
  if (n < MIN_SAMPLE) return `${label}：样本不足（${n} 条 < ${MIN_SAMPLE}），仅供参考`;
  if (pct >= 70) return `${label}：应验率 ${pct}%，断法较为稳定`;
  if (pct >= 40) return `${label}：应验率 ${pct}%，建议回看关键规则并对照实际`;
  return `${label}：应验率 ${pct}%，建议复盘取用神与断法`;
}

export function isSampleEnough(n: number): boolean {
  return n >= MIN_SAMPLE;
}
