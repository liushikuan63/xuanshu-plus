/**
 * 农历/黄历适配层：委托 lunar-javascript（锁 ~1.7.7）
 * 原则（v5 §4）：农历与闰月不自研；lunar 仅提供农历、干支、节气等查表能力。
 * 所有外部输入经本适配层归一化，杜绝上层直接触碰第三方 API。
 */

import type { Solar, Lunar } from 'lunar-javascript';
import { indexOfGanZhi } from './ganzhi.js';

export interface LunarDateInfo {
  lunarYear: number;
  lunarMonth: number;
  isLeap: boolean;
  lunarDay: number;
  /** 农历文本，如「二〇二六年八月初一」 */
  lunarText: string;
  yearGanZhi: string;
  monthGanZhi: string;
  dayGanZhi: string;
  /** 干支索引 0..59 */
  yearGanZhiIndex: number;
  monthGanZhiIndex: number;
  dayGanZhiIndex: number;
  /** 旬空（两字，如「戌亥」） */
  xunKong: string;
  zodiac: string; // 生肖
  solarText: string;
}

let lunarLib: typeof import('lunar-javascript') | null = null;

async function lib(): Promise<typeof import('lunar-javascript')> {
  if (!lunarLib) {
    lunarLib = await import('lunar-javascript');
  }
  return lunarLib;
}

function lunarToInfo(solar: Solar): LunarDateInfo {
  const l: Lunar = solar.getLunar();
  const dayGz = l.getDayInGanZhi();
  return {
    lunarYear: l.getYear(),
    lunarMonth: l.getMonth(),
    isLeap: l.getMonthInChinese().startsWith('闰'),
    lunarDay: l.getDay(),
    lunarText: l.toString(),
    yearGanZhi: l.getYearInGanZhi(),
    monthGanZhi: l.getMonthInGanZhi(),
    dayGanZhi: dayGz,
    yearGanZhiIndex: indexOfGanZhi(l.getYearInGanZhi()[0] as never, l.getYearInGanZhi()[1] as never),
    monthGanZhiIndex: indexOfGanZhi(l.getMonthInGanZhi()[0] as never, l.getMonthInGanZhi()[1] as never),
    dayGanZhiIndex: indexOfGanZhi(dayGz[0] as never, dayGz[1] as never),
    xunKong: l.getDayXunKong(),
    zodiac: l.getYearShengXiao(),
    solarText: solar.toYmdHms(),
  };
}

/** 公历年月日时（东八区）→ 农历信息 */
export async function solarToLunar(year: number, month: number, day: number, hour = 12): Promise<LunarDateInfo> {
  const { Solar } = await lib();
  const s = Solar.fromYmdHms(year, month, day, hour, 0, 0);
  return lunarToInfo(s);
}

/**
 * 同步缓存版（lunar-javascript 为同步库，首次加载后可直接使用）。
 * 若尚未加载，返回 null，调用方应先行 ensureLoaded()。
 */
let loaded = false;
export async function ensureLunarLoaded(): Promise<void> {
  await lib();
  loaded = true;
}
export function isLunarLoaded(): boolean {
  return loaded;
}

export { lunarLib };
