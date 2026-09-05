/**
 * 六爻排盘引擎：起卦（摇卦/报数/手动/时间）、装卦（纳甲/六亲/世应/六神）、
 * 动变、互卦、伏神、旬空月破。
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { dateToJd } from '../../astronomy/jde.js';
import { dayGanZhiFromJdn, ganZhiFromIndex, monthGanZhi, type Gan, type GanZhi, type Zhi } from '../../calendar/ganzhi.js';
import { monthPillarInfo } from '../../calendar/monthPillar.js';
import { configHashOf } from '../../plugins/registry.js';
import {
  hexagramFromLines,
  hexagramName,
  liuShenOf,
  xunKongOf,
  type LiuQin,
  type TrigramName,
} from './trigrams.js';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const TRI_LINES: Record<string, number[]> = {
  乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0],
  巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0],
};
const TRI_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'] as const;

function benGongLines(gong: TrigramName): number[] {
  const t = TRI_LINES[gong]!;
  return [...t, ...t];
}

export interface LiuyaoConfig {
  shiyingSource: 'table';
  zishiSplit: '23:00' | '0:00';
  fushenEnabled: boolean;
  sanheEnabled: boolean;
}

export const LIUYAO_DEFAULT_CONFIG: LiuyaoConfig = {
  shiyingSource: 'table',
  zishiSplit: '23:00',
  fushenEnabled: true,
  sanheEnabled: true,
};

export interface LiuyaoLine {
  index: number;
  value: number; // 6|7|8|9
  yang: boolean;
  moving: boolean;
  stem: Gan;
  branch: Zhi;
  liuqin: LiuQin;
  liuShen: string;
  isShi: boolean;
  isYing: boolean;
  xunKong: boolean;
  yuePo: boolean;
  riChong: boolean;
  fuShen?: { qin: LiuQin; branch: Zhi; stem: Gan };
}

export interface LiuyaoChart {
  art: 'liuyao';
  method: string;
  values: number[];
  benName: string;
  bianName: string | null;
  huName: string;
  movingIndices: number[];
  monthPillar: GanZhi;
  dayPillar: GanZhi;
  dayGanZhiIndex: number;
  xunKong: string[];
  lines: LiuyaoLine[];
  configHash: string;
  normalized: NormalizedMoment;
  config: LiuyaoConfig;
}

function momentOfInput(input: RawInput, ctx: EngineCtx, tzOffsetHours: number): NormalizedMoment {
  const t = input.time
    ? {
        year: input.time.year, month: input.time.month, day: input.time.day,
        hour: input.time.hour, minute: input.time.minute ?? 0, second: input.time.second ?? 0,
        tzOffsetHours: input.time.tzOffsetHours ?? tzOffsetHours,
      }
    : (() => {
        const d = ctx.now;
        return {
          year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
          hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
          tzOffsetHours,
        };
      })();
  const { year, month, day, hour, minute, second } = t;
  const jd = dateToJd(year, month, day, hour + minute / 60 + second / 3600) - t.tzOffsetHours / 24;
  const jdn = Math.floor(jd + 0.5);
  return {
    year, month, day, hour, minute, second,
    jd, jdn,
    tzOffsetHours: t.tzOffsetHours,
    dayGanZhiIndex: dayGanZhiFromJdn(jdn).index,
    xunKong: xunKongOf(dayGanZhiFromJdn(jdn).index).join(''),
  };
}

/** 摇卦：六次掷币，记「背（阳）」数 */
export function castCoins(random: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    let backs = 0;
    for (let c = 0; c < 3; c++) backs += random() < 0.5 ? 1 : 0;
    out.push(backs === 3 ? 9 : backs === 2 ? 7 : backs === 1 ? 8 : 6);
  }
  return out;
}

/** 报数起卦：上卦/下卦/动爻（先天数 1乾2兑3离4震5巽6坎7艮8坤） */
export function castFromNumbers(numbers: [number, number, number]): number[] {
  const upper = ((numbers[0] - 1) % 8 + 8) % 8;
  const lower = ((numbers[1] - 1) % 8 + 8) % 8;
  let moving = numbers[2] % 6;
  if (moving === 0) moving = 6;
  const lines = [...TRI_LINES[TRI_NAMES[lower]!]!, ...TRI_LINES[TRI_NAMES[upper]!]!];
  lines[moving - 1] = lines[moving - 1] === 1 ? 9 : 6;
  return lines;
}

/** 时间起卦（梅花式）：年支+月+日 → 上卦，加时支 → 下卦、动爻 */
export function castFromTime(year: number, month: number, day: number, hour: number): number[] {
  const zhiIndex = ((year - 4) % 12 + 12) % 12;
  const hourZhi = Math.floor((hour + 1) / 2) % 12;
  const upper = (zhiIndex + month + day) % 8;
  const lower = (zhiIndex + month + day + hourZhi) % 8;
  const moving = ((zhiIndex + month + day + hourZhi) % 6) || 6;
  const lines = [...TRI_LINES[TRI_NAMES[lower % 8]!]!, ...TRI_LINES[TRI_NAMES[upper % 8]!]!];
  lines[moving - 1] = lines[moving - 1] === 1 ? 9 : 6;
  return lines;
}

export function parseManualValues(text: string): number[] {
  const chars = text.replace(/[^6789]/g, '');
  if (chars.length !== 6) throw new Error('手动爻值必须为 6 位（6/7/8/9，初→上）');
  return chars.split('').map(Number);
}

/** 构造变卦（动爻变化：6→7，9→8） */
export function bianValuesOf(values: number[]): number[] | null {
  if (!values.some((v) => v === 6 || v === 9)) return null;
  return values.map((v) => (v === 6 ? 7 : v === 9 ? 8 : v));
}

/** 互卦：取 2/3/4 爻为下卦，3/4/5 爻为上卦 */
export function huValuesOf(values: number[]): number[] {
  return [values[1]! % 2, values[2]! % 2, values[3]! % 2, values[2]! % 2, values[3]! % 2, values[4]! % 2];
}

/** 伏神：卦中缺失的六亲，从本宫八纯卦对应爻位取 */
export function fuShenOf(gong: TrigramName, presentQin: LiuQin[]): Array<{ index: number; qin: LiuQin; branch: string; stem: string }> {
  const all: LiuQin[] = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
  const missing = all.filter((q) => !presentQin.includes(q));
  if (missing.length === 0) return [];
  const gongInfo = hexagramFromLines(benGongLines(gong));
  const out: Array<{ index: number; qin: LiuQin; branch: string; stem: string }> = [];
  for (const m of missing) {
    const idx = gongInfo.liuqin.indexOf(m);
    if (idx >= 0) out.push({ index: idx, qin: m, branch: gongInfo.najia[idx]!.branch, stem: gongInfo.najia[idx]!.stem });
  }
  return out;
}

/** 由爻值 + 归一化时刻 + 配置 → 完整盘面 */
export async function buildChart(
  values: number[],
  normalized: NormalizedMoment,
  config: LiuyaoConfig = LIUYAO_DEFAULT_CONFIG,
): Promise<LiuyaoChart> {
  const info = await monthPillarInfo(normalized.year, normalized.month, normalized.day, normalized.hour, normalized.tzOffsetHours);
  const monthZhiIdx = (DIZHI.indexOf(info.monthZhi) + 12) % 12;
  const fromYin = ((monthZhiIdx - 2) % 12 + 12) % 12;
  const monthP = monthGanZhi(info.yearGanZhiIndex, fromYin);

  let dayIndex = normalized.dayGanZhiIndex;
  if (config.zishiSplit === '23:00' && normalized.hour >= 23) dayIndex = (dayIndex + 1) % 60;
  const dayP = ganZhiFromIndex(dayIndex);
  const xk = xunKongOf(dayIndex);

  const ben = hexagramFromLines(values);
  const bianValues = bianValuesOf(values);
  const bian = bianValues ? hexagramFromLines(bianValues) : null;
  const hu = hexagramFromLines(huValuesOf(values));

  const fuShenAll = config.fushenEnabled ? fuShenOf(ben.gong, ben.liuqin) : [];
  const lines: LiuyaoLine[] = values.map((v, i) => {
    const moving = v === 6 || v === 9;
    const branch = ben.najia[i]!.branch as Zhi;
    const xunKongHit = xk.includes(branch);
    const yuePo = branch === DIZHI[(monthZhiIdx + 6) % 12]!;
    const riChong = branch === dayP.zhi;
    const fu = fuShenAll.find((f) => f.index === i);
    return {
      index: i,
      value: v,
      yang: v === 7 || v === 9,
      moving,
      stem: ben.najia[i]!.stem,
      branch,
      liuqin: ben.liuqin[i]!,
      liuShen: liuShenOf(dayP.gan, i),
      isShi: i === ben.shiIndex,
      isYing: i === ben.yingIndex,
      xunKong: xunKongHit,
      yuePo,
      riChong,
      fuShen: fu ? { qin: fu.qin, branch: fu.branch as Zhi, stem: fu.stem as Gan } : undefined,
    };
  });

  const cfgHash = configHashOf({
    ...config,
    method: values.join(''),
    date: `${normalized.year}-${normalized.month}-${normalized.day} ${normalized.hour}:${normalized.minute}`,
  });

  return {
    art: 'liuyao',
    method: values.join(''),
    values,
    benName: ben.name,
    bianName: bian?.name ?? null,
    huName: hu.name,
    movingIndices: lines.filter((l) => l.moving).map((l) => l.index),
    monthPillar: monthP,
    dayPillar: dayP,
    dayGanZhiIndex: dayIndex,
    xunKong: xk,
    lines,
    configHash: cfgHash,
    normalized,
    config,
  };
}

export async function normalizeLiuyao(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
  return momentOfInput(input, ctx, tzOffsetHours);
}

export async function castLiuyao(input: RawInput, ctx: EngineCtx, config: LiuyaoConfig = LIUYAO_DEFAULT_CONFIG): Promise<LiuyaoChart> {
  let values: number[];
  if (input.kind === 'manual') {
    values = parseManualValues(input.text ?? '');
  } else if (input.kind === 'numbers' && input.numbers && input.numbers.length >= 3) {
    values = castFromNumbers([input.numbers[0]!, input.numbers[1]!, input.numbers[2]!]);
  } else if (input.kind === 'random') {
    values = castCoins(ctx.random);
  } else {
    const t = input.time ?? {
      year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(),
      hour: ctx.now.getHours(), minute: ctx.now.getMinutes(), second: ctx.now.getSeconds(),
    };
    values = castFromTime(t.year, t.month, t.day, t.hour);
  }
  const normalized = momentOfInput(input, ctx, ctx.tzOffsetHours ?? 8);
  return buildChart(values, normalized, config);
}

export { hexagramName };
