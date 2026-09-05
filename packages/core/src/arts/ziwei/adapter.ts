/**
 * 紫微斗数适配层（D18）：安星引擎委托 iztro（锁 ~2.6.0），不自研安星。
 * 本层只做输入归一化与输出规范化；流派配置（四化/亮度）在 iztro 侧配置后入 configHash。
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { dateToJd } from '../../astronomy/jde.js';
import { dayGanZhiFromJdn } from '../../calendar/ganzhi.js';
import { configHashOf } from '../../plugins/registry.js';
import { xunKongOf } from '../liuyao/trigrams.js';

export interface ZiweiConfig {
  fixLeap: boolean;
  language: 'zh-CN';
}

export const ZIWEI_DEFAULT_CONFIG: ZiweiConfig = { fixLeap: true, language: 'zh-CN' };

export interface ZiweiPalace {
  name: string;
  index: number; // 0=命宫 …
  heavenlyStem: string;
  earthlyBranch: string;
  stars: string[];
  mutagen: string[];
}

export interface ZiweiChart {
  art: 'ziwei';
  solarDate: string;
  timeIndex: number;
  gender: '男' | '女';
  fixLeap: boolean;
  fiveElementsClass: string;   // 五行局
  soul: string;                // 命主
  body: string;                // 身主
  palaces: ZiweiPalace[];
  decadal: Array<{ index: number; range: string; stars: string[] }>;
  configHash: string;
  normalized: NormalizedMoment;
  config: ZiweiConfig;
}

/** 时辰 → iztro timeIndex（0=早子时 … 12=晚子时） */
export function iztroTimeIndex(hour: number): number {
  if (hour === 0) return 0;
  if (hour === 23) return 12;
  return Math.floor((hour + 1) / 2);
}

type IztroAstrolabe = {
  fiveElementsClass?: string;
  soul?: string;
  body?: string;
  palaces?: Array<{
    name?: string;
    index?: number;
    heavenlyStem?: string;
    earthlyBranch?: string;
    majorStars?: Array<{ name?: string }>;
    minorStars?: Array<{ name?: string }>;
    adjectiveStars?: Array<{ name?: string }>;
    mutagen?: string[];
  }>;
  decadalList?: Array<{ index?: number; range?: string; palaces?: Array<{ stars?: Array<{ name?: string }> }> }>;
};

async function iztroModule(): Promise<typeof import('iztro')> {
  return import('iztro');
}

export async function castZiwei(
  input: { year: number; month: number; day: number; hour: number; minute?: number; gender: '男' | '女' },
  config: ZiweiConfig = ZIWEI_DEFAULT_CONFIG,
  tzOffsetHours = 8,
): Promise<ZiweiChart> {
  const { astro } = await iztroModule();
  const solarDate = `${input.year}-${input.month}-${input.day}`;
  const timeIndex = iztroTimeIndex(input.hour);
  const raw = (await astro.bySolar(solarDate, timeIndex, input.gender, config.fixLeap, config.language)) as unknown as IztroAstrolabe;

  const palaces: ZiweiPalace[] = (raw.palaces ?? []).map((p) => ({
    name: p.name ?? '',
    index: p.index ?? 0,
    heavenlyStem: p.heavenlyStem ?? '',
    earthlyBranch: p.earthlyBranch ?? '',
    stars: [
      ...(p.majorStars ?? []),
      ...(p.minorStars ?? []),
      ...(p.adjectiveStars ?? []),
    ].map((s) => s.name ?? '').filter(Boolean),
    mutagen: p.mutagen ?? [],
  }));

  const decadal = (Array.isArray(raw.decadalList) ? raw.decadalList : []).map((d) => ({
    index: d.index ?? 0,
    range: d.range ?? '',
    stars: (d.palaces ?? []).flatMap((pal) => (pal.stars ?? []).map((s) => s.name ?? '')).filter(Boolean),
  }));

  const jd = dateToJd(input.year, input.month, input.day, input.hour + (input.minute ?? 0) / 60) - tzOffsetHours / 24;
  const jdn = Math.floor(jd + 0.5);
  const normalized: NormalizedMoment = {
    year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute ?? 0, second: 0,
    jd, jdn, tzOffsetHours,
    dayGanZhiIndex: dayGanZhiFromJdn(jdn).index,
    xunKong: xunKongOf(dayGanZhiFromJdn(jdn).index).join(''),
  };

  return {
    art: 'ziwei',
    solarDate,
    timeIndex,
    gender: input.gender,
    fixLeap: config.fixLeap,
    fiveElementsClass: raw.fiveElementsClass ?? '',
    soul: raw.soul ?? '',
    body: raw.body ?? '',
    palaces,
    decadal,
    configHash: configHashOf({ ...config, solarDate, timeIndex, gender: input.gender }),
    normalized,
    config,
  };
}

export async function castZiweiFromRaw(input: RawInput, ctx: EngineCtx): Promise<ZiweiChart> {
  const t = input.time
    ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour, minute: input.time.minute ?? 0, gender: '男' as const }
    : { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: ctx.now.getHours(), minute: ctx.now.getMinutes(), gender: '男' as const };
  return castZiwei(t);
}

export async function normalizeZiwei(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
  const t = input.time
    ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour, minute: input.time.minute ?? 0, second: input.time.second ?? 0, tzOffsetHours: input.time.tzOffsetHours ?? tzOffsetHours }
    : { year: ctx.now.getFullYear(), month: ctx.now.getMonth() + 1, day: ctx.now.getDate(), hour: ctx.now.getHours(), minute: ctx.now.getMinutes(), second: ctx.now.getSeconds(), tzOffsetHours };
  const jd = dateToJd(t.year, t.month, t.day, t.hour + t.minute / 60 + t.second / 3600) - t.tzOffsetHours / 24;
  const jdn = Math.floor(jd + 0.5);
  return {
    year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second,
    jd, jdn, tzOffsetHours: t.tzOffsetHours,
    dayGanZhiIndex: dayGanZhiFromJdn(jdn).index,
    xunKong: xunKongOf(dayGanZhiFromJdn(jdn).index).join(''),
  };
}
