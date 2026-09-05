/**
 * 梅花易数引擎：时间/报数/字占起卦、体用生克、互变卦。
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { civilJdn, dateToJd } from '../../astronomy/jde.js';
import { dayGanZhiFromJdn } from '../../calendar/ganzhi.js';
import { configHashOf } from '../../plugins/registry.js';
import { hexagramFromLines, xunKongOf } from '../liuyao/trigrams.js';
import { huValuesOf, bianValuesOf } from '../liuyao/engine.js';

const TRI_LINES: Record<string, number[]> = {
  乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0],
  巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0],
};
const TRI_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'] as const;

export interface MeihuaConfig {
  tiYongRule: 'dong-bian-yong';
  huGuaEnabled: boolean;
  bianGuaEnabled: boolean;
}

export const MEIHUA_DEFAULT_CONFIG: MeihuaConfig = {
  tiYongRule: 'dong-bian-yong',
  huGuaEnabled: true,
  bianGuaEnabled: true,
};

export interface MeihuaChart {
  art: 'meihua';
  method: string;
  benName: string;
  bianName: string | null;
  huName: string;
  ti: string;
  yong: string;
  tiYongRelation: '用生体' | '体生用' | '用克体' | '体克用' | '比和';
  judgment: string;
  movingIndex: number; // 0..5
  configHash: string;
  normalized: NormalizedMoment;
  config: MeihuaConfig;
}

const TI_YONG_JUDGMENT: Record<MeihuaChart['tiYongRelation'], string> = {
  用生体: '用卦生体卦，吉，主有人相助、事有生机。',
  体生用: '体卦生用卦，泄气，主耗费心力财物，事缓而费。',
  用克体: '用卦克体卦，凶，主事受阻、防损失与压力。',
  体克用: '体卦克用卦，小吉，主己方能制事，但费力。',
  比和: '体用比和，吉，主顺遂平和，事易成。',
};

function trigramOf(lines: number[], offset: number): string {
  const [a, b, c] = [lines[offset]! % 2, lines[offset + 1]! % 2, lines[offset + 2]! % 2];
  return TRI_NAMES.find((n) => TRI_LINES[n]![0] === a && TRI_LINES[n]![1] === b && TRI_LINES[n]![2] === c)!;
}

export function castMeihuaByNumbers(a: number, b: number, c?: number): number[] {
  const upper = ((a - 1) % 8 + 8) % 8;
  const lower = ((b - 1) % 8 + 8) % 8;
  let moving = 0;
  if (c !== undefined) {
    moving = c % 6 || 6;
  } else {
    moving = (a + b) % 6 || 6;
  }
  const lines = [...TRI_LINES[TRI_NAMES[lower % 8]!]!, ...TRI_LINES[TRI_NAMES[upper % 8]!]!];
  lines[moving - 1] = lines[moving - 1] === 1 ? 9 : 6;
  return lines;
}

export function castMeihuaByTime(year: number, month: number, day: number, hour: number): number[] {
  const zhiIndex = ((year - 4) % 12 + 12) % 12;
  const hourZhi = Math.floor((hour + 1) / 2) % 12;
  const upper = (zhiIndex + month + day) % 8;
  const lower = (zhiIndex + month + day + hourZhi) % 8;
  const moving = ((zhiIndex + month + day + hourZhi) % 6) || 6;
  const lines = [...TRI_LINES[TRI_NAMES[lower % 8]!]!, ...TRI_LINES[TRI_NAMES[upper % 8]!]!];
  lines[moving - 1] = lines[moving - 1] === 1 ? 9 : 6;
  return lines;
}

/** 字占：两字起卦（一字用笔画） */
export function castMeihuaByWords(words: string): number[] {
  const chars = [...words.replace(/\s/g, '')];
  if (chars.length === 0) throw new Error('字占需要至少一个字');
  const upper = (chars[0]!.codePointAt(0)! % 8);
  const lower = (chars.length >= 2 ? chars[1]!.codePointAt(0)! : 1) % 8;
  const moving = (chars.reduce((s, ch) => s + (ch.codePointAt(0) ?? 0), 0) % 6) || 6;
  const lines = [...TRI_LINES[TRI_NAMES[lower % 8]!]!, ...TRI_LINES[TRI_NAMES[upper % 8]!]!];
  lines[moving - 1] = lines[moving - 1] === 1 ? 9 : 6;
  return lines;
}

export async function buildMeihuaChart(
  values: number[],
  normalized: NormalizedMoment,
  config: MeihuaConfig = MEIHUA_DEFAULT_CONFIG,
): Promise<MeihuaChart> {
  const ben = hexagramFromLines(values);
  const moving = values.findIndex((v) => v === 6 || v === 9);
  const movingIdx = moving === -1 ? 0 : moving;
  // 体用：动爻所在卦为用，另一卦为体
  const ti = trigramOf(values, movingIdx < 3 ? 3 : 0);
  const yong = trigramOf(values, movingIdx < 3 ? 0 : 3);
  const rel = tiYongRelation(ti, yong);
  const bianValues = config.bianGuaEnabled ? bianValuesOf(values) : null;
  const huValues = config.huGuaEnabled ? huValuesOf(values) : null;
  return {
    art: 'meihua',
    method: values.join(''),
    benName: ben.name,
    bianName: bianValues ? hexagramFromLines(bianValues).name : null,
    huName: huValues ? hexagramFromLines(huValues).name : '',
    ti,
    yong,
    tiYongRelation: rel,
    judgment: TI_YONG_JUDGMENT[rel],
    movingIndex: movingIdx,
    configHash: configHashOf({ ...config, method: values.join(''), date: `${normalized.year}-${normalized.month}-${normalized.day}` }),
    normalized,
    config,
  };
}

/** 体用生克（先天五行） */
export function tiYongRelation(ti: string, yong: string): MeihuaChart['tiYongRelation'] {
  const wx: Record<string, '木' | '火' | '土' | '金' | '水'> = {
    乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土',
  };
  const t = wx[ti]!;
  const y = wx[yong]!;
  const sheng: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  if (sheng[y] === t) return '用生体';
  if (sheng[t] === y) return '体生用';
  if (y === t) return '比和';
  const ke: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  if (ke[y] === t) return '用克体';
  return '体克用';
}

export async function normalizeMeihua(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
  const t = input.time
    ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour, minute: input.time.minute ?? 0, second: input.time.second ?? 0, tzOffsetHours: input.time.tzOffsetHours ?? tzOffsetHours }
    : { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: ctx.now.getHours(), minute: ctx.now.getMinutes(), second: ctx.now.getSeconds(), tzOffsetHours };
  const jd = dateToJd(t.year, t.month, t.day, t.hour + t.minute / 60 + t.second / 3600) - t.tzOffsetHours / 24;
  const jdn = civilJdn(t.year, t.month, t.day);
  return {
    year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second,
    jd, jdn, tzOffsetHours: t.tzOffsetHours,
    dayGanZhiIndex: dayGanZhiFromJdn(jdn).index,
    xunKong: xunKongOf(dayGanZhiFromJdn(jdn).index).join(''),
  };
}

export async function castMeihua(input: RawInput, ctx: EngineCtx, config: MeihuaConfig = MEIHUA_DEFAULT_CONFIG): Promise<MeihuaChart> {
  let values: number[];
  if (input.kind === 'numbers' && input.numbers && input.numbers.length >= 2) {
    values = castMeihuaByNumbers(input.numbers[0]!, input.numbers[1]!, input.numbers[2]);
  } else if (input.kind === 'words' && input.words) {
    values = castMeihuaByWords(input.words);
  } else if (input.kind === 'manual') {
    const { parseManualValues } = await import('../liuyao/engine.js');
    values = parseManualValues(input.text ?? '');
  } else {
    const t = input.time ?? { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: ctx.now.getHours(), minute: ctx.now.getMinutes() };
    values = castMeihuaByTime(t.year, t.month, t.day, t.hour);
  }
  const normalized = await normalizeMeihua(input, ctx, ctx.tzOffsetHours ?? 8);
  return buildMeihuaChart(values, normalized, config);
}
