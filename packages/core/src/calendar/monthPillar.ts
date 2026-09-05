/**
 * 月柱推算：以「节」为月界（立春=正月寅月），五虎遁定天干。
 * 换年规则：立春前属上一年年支（与年柱一致）。
 */

import { solarTermsOfYear, type SolarTermName } from './solarTerms.js';
import { dateToJd, deltaT } from '../astronomy/jde.js';
import { DIZHI, monthGanZhi, ganZhiFromIndex, type Zhi, type GanZhi } from './ganzhi.js';

/** 十二「节」→ 月支 */
const JIE_TO_MONTH_ZHI: Record<string, Zhi> = {
  立春: '寅', 惊蛰: '卯', 清明: '辰', 立夏: '巳', 芒种: '午', 小暑: '未',
  立秋: '申', 白露: '酉', 寒露: '戌', 立冬: '亥', 大雪: '子', 小寒: '丑',
};

export interface YearInfo {
  /** 立春时刻（东八区）对应的年支年干序：该年「农历纪年」干支索引 */
  liChunYearGanZhiIndex: number;
  /** 该公历年内立春的公历日序（用于判断换年） */
  liChunJde: number;
}

const termCache = new Map<number, Awaited<ReturnType<typeof solarTermsOfYear>>>();

async function termsFor(year: number): Promise<Awaited<ReturnType<typeof solarTermsOfYear>>> {
  let t = termCache.get(year);
  if (!t) {
    t = await solarTermsOfYear(year);
    termCache.set(year, t);
  }
  return t;
}

/** 公历年月日时（本地时）→ 节气月支 + 立春信息 */
export async function monthPillarInfo(
  year: number,
  month: number,
  day: number,
  hour: number,
  tzOffsetHours = 8,
): Promise<{ monthZhi: Zhi; yearGanZhiIndex: number; liChunPassed: boolean }> {
  const dateJde = dateToJd(year, month, day, hour) - tzOffsetHours / 24 + deltaT(dateToJd(year, month, day, hour)) / 86400;
  const [prev, cur, next] = await Promise.all([termsFor(year - 1), termsFor(year), termsFor(year + 1)]);
  const allJie = [...prev, ...cur, ...next]
    .filter((t) => t.jie)
    .sort((a, b) => a.jde - b.jde);
  let boundary: SolarTermName | null = null;
  for (let i = 0; i < allJie.length; i++) {
    const t = allJie[i]!;
    if (t.jde <= dateJde) boundary = t.name;
    else break;
  }
  if (!boundary) boundary = '小寒';
  const monthZhi = JIE_TO_MONTH_ZHI[boundary]!;
  // 换年：当年立春是否已过
  const liChun = cur.find((t) => t.name === '立春')!;
  const liChunPassed = dateJde >= liChun.jde;
  const yearGanZhiIndex = liChunPassed ? year - 4 : year - 1 - 4;
  return { monthZhi, yearGanZhiIndex, liChunPassed };
}

/** 月柱干支 */
export async function monthGanZhiOf(
  year: number,
  month: number,
  day: number,
  hour: number,
  tzOffsetHours = 8,
): Promise<GanZhi> {
  const { monthZhi, yearGanZhiIndex } = await monthPillarInfo(year, month, day, hour, tzOffsetHours);
  const zhiIndex = DIZHI.indexOf(monthZhi);
  const fromYin = ((zhiIndex - 2) % 12 + 12) % 12; // 寅=0
  return monthGanZhi(yearGanZhiIndex, fromYin);
}

/** 年柱干支（立春换年） */
export async function yearGanZhiOf(year: number, month: number, day: number, hour: number, tzOffsetHours = 8): Promise<GanZhi> {
  const { yearGanZhiIndex } = await monthPillarInfo(year, month, day, hour, tzOffsetHours);
  return ganZhiFromIndex(yearGanZhiIndex);
}
