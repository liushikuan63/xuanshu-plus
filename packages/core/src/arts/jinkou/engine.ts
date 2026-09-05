/**
 * 大六壬金口诀引擎（自研实现）
 * 起课链路：地分 → 月将加占时（天盘）→ 贵神（昼夜贵人定天将布十二支，取地分所乘之将）→ 人元（五鼠遁数至月将之干）。
 * 四位五行：人元（天）· 贵神（人）· 月将（事）· 地分（地），是断课根基。
 * 简化与流派说明（可复算、可测试）：
 *   - 地分以「占时支」默认取（方位/报数取地分不在本版，留待扩展）
 *   - 月将/贵人/天将与大六壬同源（节气月支六合之将；甲戊庚牛羊…昼夜贵口诀）
 *   - 人元以五鼠遁（日干+时支起时干）沿支环数至月将支得干
 *   - 断语全部 D 级「流派说法」，无伪引文
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { civilJdn, dateToJd } from '../../astronomy/jde.js';
import {
  DIZHI, ZHI_LIUHE, TIANGAN, dayGanZhiFromJdn, ganZhiFromIndex, hourGanZhi, monthGanZhi,
  type Gan, type WuXing, type Zhi,
} from '../../calendar/ganzhi.js';
import { monthPillarInfo } from '../../calendar/monthPillar.js';
import { configHashOf } from '../../plugins/registry.js';
import { xunKongOf } from '../liuyao/trigrams.js';
import { heavenPlate, guiRenOf, guiGodsOf, yiMaOf, type GuiGod } from '../liuren/engine.js';

/** 十二天将五行（贵人土…） */
export const GOD_WUXING: Record<string, WuXing> = {
  贵人: '土', 螣蛇: '火', 朱雀: '火', 六合: '木', 勾陈: '土', 青龙: '木',
  天空: '土', 白虎: '金', 太常: '土', 玄武: '水', 太阴: '金', 天后: '水',
};

export interface JinKouChart {
  art: 'jinkou';
  method: string;
  year: string;      // 年柱
  month: string;     // 月柱
  day: string;       // 日柱
  hour: string;      // 时柱
  dayGan: Gan;
  diFen: Zhi;        // 地分（本版=占时支）
  diFenSource: DiFenSource; // 地分来源（时间/报数）
  yueJiang: Zhi;     // 月将支
  guiShen: string;   // 贵神（十二天将之一，加临地分者）
  guiRen: Zhi;       // 贵人支
  isDayGui: boolean; // 昼贵与否
  renYuan: Gan;      // 人元（将干）
  guiGods: GuiGod[]; // 十二天将布支
  heaven: Record<Zhi, Zhi>;
  yiMa: Zhi;
  xunKong: string;
  xunKongBranches: Zhi[];
  configHash: string;
  normalized: NormalizedMoment;
}

/** 五鼠遁：日干（序）+ 时支（序）→ 时干（与 hourGanZhi 同逻辑） */
function shiGanOf(dayGanIndex: number, shiZhiIndex: number): number {
  return ((dayGanIndex % 5) * 2 + shiZhiIndex) % 10;
}

/**
 * 人元（将干）：从时支起五鼠遁干支联动，数至「月将支」所得之干。
 * 即天盘月将位上所透之干；本函数按干支环顺数（每进一支干进一位）。
 */
export function renYuanOf(dayGanIndex: number, shiZhiIndex: number, yueJiang: Zhi): Gan {
  const g0 = shiGanOf(dayGanIndex, shiZhiIndex);
  const jiangIdx = DIZHI.indexOf(yueJiang);
  const k = ((jiangIdx - shiZhiIndex) % 12 + 12) % 12;
  return TIANGAN[(g0 + k) % 10]!;
}

/** 归一化时刻（与其它术数一致） */
export async function normalizeJinKou(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
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

// ---------------------------------------------------------------- 地分取法

/** 地分来源：占时支（时间起课）／报数（报数取地分） */
export type DiFenSource = 'time' | 'numbers';

/**
 * 报数取地分（金口诀通行）：1→子 … 12→亥，超出 12 取 (n-1) mod 12。
 * 报数语义即「问事之方向序号」，为问事者自定，非随机数源。
 */
export function diFenFromNumber(n: number): Zhi {
  const r = (((Math.floor(n) - 1) % 12) + 12) % 12;
  return DIZHI[r]!;
}

// ---------------------------------------------------------------- 起课

/** 金口诀起课（时间/报数起课） */
export async function castJinKou(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<JinKouChart> {
  if (input.kind !== 'time' && input.kind !== 'numbers') {
    throw new Error('金口诀支持「时间起课」或「报数取地分」');
  }
  const norm = await normalizeJinKou(input, ctx, tzOffsetHours);
  const { year, month, day, hour } = norm;

  const info = await monthPillarInfo(year, month, day, hour, norm.tzOffsetHours);
  const yearPillarGz = ganZhiFromIndex(info.yearGanZhiIndex);
  const monthZhiIndex = DIZHI.indexOf(info.monthZhi);
  const monthPillarGz = monthGanZhi(info.yearGanZhiIndex, ((monthZhiIndex - 2) % 12 + 12) % 12);

  let dayIndex = dayGanZhiFromJdn(norm.jdn).index;
  if (hour >= 23) dayIndex = (dayIndex + 1) % 60;
  const dayGz = ganZhiFromIndex(dayIndex);
  const shiZhiIndex = Math.floor((hour + 1) / 2) % 12;
  const hourGz = hourGanZhi(dayIndex % 10, shiZhiIndex);
  const dayGan = dayGz.gan as Gan;
  const shiZhi = DIZHI[shiZhiIndex]!;

  // 地分：占时支（时间起课）或报数对应支（报数起课；取首数）
  const diFenSource: DiFenSource = input.kind === 'time' ? 'time' : 'numbers';
  const diFen = diFenSource === 'time'
    ? shiZhi
    : diFenFromNumber(input.numbers?.find((n) => Number.isFinite(n)) ?? 1);

  // 月将 = 节气月支六合；天盘 = 月将加占时
  const yueJiang = ZHI_LIUHE[info.monthZhi]!;
  const heaven = heavenPlate(yueJiang, shiZhi);

  // 贵神：昼夜贵人定贵人支 → 十二天将布十二支 → 取地分所乘之将；贵人环顺逆与大六壬一致
  const { branch: guiRen, isDay: isDayGui } = guiRenOf(dayGan, shiZhi);
  const guiGods = guiGodsOf(guiRen, isDayGui);
  const guiShen = guiGods.find((g) => g.branch === diFen)?.god ?? '—';

  // 人元 = 五鼠遁数至月将之干
  const renYuan = renYuanOf(dayIndex % 10, shiZhiIndex, yueJiang);

  const xunKong = xunKongOf(dayIndex).join('');
  const xunKongBranches = [...xunKong] as Zhi[];
  const configHash = configHashOf({ diFen: String(diFen), diFenSource, yueJiang: String(yueJiang), date: `${year}-${month}-${day} ${hour}:${norm.minute}` });

  return {
    art: 'jinkou',
    method: `${diFenSource === 'time' ? '时间起课' : '报数取地分'}（地分${diFen} · 月将${yueJiang}加占时${shiZhi}）`,
    year: yearPillarGz.gan + yearPillarGz.zhi,
    month: monthPillarGz.gan + monthPillarGz.zhi,
    day: dayGz.gan + dayGz.zhi,
    hour: hourGz.gan + hourGz.zhi,
    dayGan,
    diFen,
    diFenSource,
    yueJiang,
    guiShen,
    guiRen,
    isDayGui,
    renYuan,
    guiGods,
    heaven,
    yiMa: yiMaOf(dayGz.zhi),
    xunKong,
    xunKongBranches,
    configHash,
    normalized: norm,
  };
}
