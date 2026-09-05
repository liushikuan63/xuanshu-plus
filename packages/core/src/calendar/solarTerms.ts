/**
 * 二十四节气（定气）：以太阳视黄经为目标角度，逆迭代求交 JDE。
 * 主引擎默认 VSOP87（astronomy-engine）；可用 simplifiedMeeus 回退/对照。
 */

import { solarTermJde, solarLongitude } from '../astronomy/solarLongitude.js';
import { jdToDate, deltaT, dateToJd } from '../astronomy/jde.js';

/** 按时间顺序的节气名（立春起），偶数为「节」，奇数为「中气」 */
export const SOLAR_TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
] as const;

export type SolarTermName = (typeof SOLAR_TERMS)[number];

/** 各节气对应的太阳视黄经（度） */
export const TERM_LONGITUDE: Record<SolarTermName, number> = {
  立春: 315, 雨水: 330, 惊蛰: 345, 春分: 0, 清明: 15, 谷雨: 30,
  立夏: 45, 小满: 60, 芒种: 75, 夏至: 90, 小暑: 105, 大暑: 120,
  立秋: 135, 处暑: 150, 白露: 165, 秋分: 180, 寒露: 195, 霜降: 210,
  立冬: 225, 小雪: 240, 大雪: 255, 冬至: 270, 小寒: 285, 大寒: 300,
};

/** 各节气的公历近似日期（月/日），作为求交种子 */
const TERM_SEED: Record<SolarTermName, [number, number]> = {
  小寒: [1, 6], 大寒: [1, 20], 立春: [2, 4], 雨水: [2, 19],
  惊蛰: [3, 6], 春分: [3, 21], 清明: [4, 5], 谷雨: [4, 20],
  立夏: [5, 6], 小满: [5, 21], 芒种: [6, 6], 夏至: [6, 21],
  小暑: [7, 7], 大暑: [7, 23], 立秋: [8, 8], 处暑: [8, 23],
  白露: [9, 8], 秋分: [9, 23], 寒露: [10, 8], 霜降: [10, 24],
  立冬: [11, 7], 小雪: [11, 22], 大雪: [12, 7], 冬至: [12, 22],
};

export function isJie(term: SolarTermName): boolean {
  return SOLAR_TERMS.indexOf(term) % 2 === 0;
}

export function isZhongQi(term: SolarTermName): boolean {
  return !isJie(term);
}

function seedJde(year: number, term: SolarTermName): number {
  const [m, d] = TERM_SEED[term]!;
  return dateToJd(year, m, d, 12);
}

export interface SolarTermResult {
  name: SolarTermName;
  jde: number;                       // 力学时
  /** 东八区当地公历时间（近似，仅展示） */
  localYear: number;
  localMonth: number;
  localDay: number;
  localHour: number;
  jie: boolean;
}

/**
 * 求某公历年某节气的 JDE 与本地时刻。
 * @param tzOffsetHours 展示用时区偏移（默认 +8）
 */
export async function solarTerm(year: number, term: SolarTermName, tzOffsetHours = 8): Promise<SolarTermResult> {
  const jde = await solarTermJde(TERM_LONGITUDE[term], seedJde(year, term));
  return toResult(jde, term, tzOffsetHours);
}

/** 求某公历年全部 24 节气（按时间排序） */
export async function solarTermsOfYear(year: number, tzOffsetHours = 8): Promise<SolarTermResult[]> {
  const results = await Promise.all(SOLAR_TERMS.map((t) => solarTerm(year, t, tzOffsetHours)));
  return results.sort((a, b) => a.jde - b.jde);
}

export function toResult(jde: number, name: SolarTermName, tzOffsetHours: number): SolarTermResult {
  const ut = jdToDate(jde - deltaT(jde) / 86400);
  // 转为东八区
  const localJd = jde - deltaT(jde) / 86400 + tzOffsetHours / 24;
  const local = jdToDate(localJd);
  void ut;
  return {
    name,
    jde,
    localYear: local.year,
    localMonth: local.month,
    localDay: local.day,
    localHour: local.hour,
    jie: isJie(name),
  };
}

/** 预加载黄经引擎（可选，提前加载避免首查延迟） */
export function preloadSolarEngine(): Promise<void> {
  return solarLongitude().then(() => undefined);
}
