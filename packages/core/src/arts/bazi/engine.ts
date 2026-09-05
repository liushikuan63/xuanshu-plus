/**
 * 八字引擎：四柱（立春换年/节气换月可配）、藏干、十神、纳音、大运起运、常用神煞。
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { civilJdn, dateToJd } from '../../astronomy/jde.js';
import {
  DIZHI,
  GAN_WUXING,
  TIANGAN,
  ZHI_WUXING,
  dayGanZhiFromJdn,
  ganZhiFromIndex,
  hourGanZhi,
  monthGanZhi,
  nayin,
  shiShenYinYang,
  type Gan,
  type GanZhi,
  type Zhi,
} from '../../calendar/ganzhi.js';
import { monthPillarInfo, monthGanZhiOf } from '../../calendar/monthPillar.js';
import { solarTermsOfYear } from '../../calendar/solarTerms.js';
import { configHashOf } from '../../plugins/registry.js';
import { xunKongOf } from '../liuyao/trigrams.js';

/** 地支藏干（主气/中气/余气） */
export const CANG_GAN: Record<Zhi, Gan[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

export interface BaziConfig {
  yearSwitch: 'lichun' | 'zhengyue';
  monthSwitch: 'jieqi' | 'chuyi';
  zishiSplit: '23:00' | '0:00';
  trueSolarTime: boolean;
}

export const BAZI_DEFAULT_CONFIG: BaziConfig = {
  yearSwitch: 'lichun',
  monthSwitch: 'jieqi',
  zishiSplit: '23:00',
  trueSolarTime: false,
};

export interface Pillar {
  gan: Gan;
  zhi: Zhi;
  index: number;
  cangGan: Gan[];
  shiShen: string[];
  nayin: string;
}

export interface DaYun {
  startAge: number;
  startYear: number;
  ganZhi: GanZhi;
  nayin: string;
}

export interface BaziChart {
  art: 'bazi';
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  dayMaster: Gan;
  dayMasterStrength: '强' | '中' | '弱';
  gender: 'male' | 'female';
  qiyun: { direction: '顺' | '逆'; age: number; startYear: number; startMonth: number };
  dayun: DaYun[];
  shensha: Record<string, string[]>;
  configHash: string;
  normalized: NormalizedMoment;
  config: BaziConfig;
}

function pillarOf(gz: GanZhi): Pillar {
  const cang = CANG_GAN[gz.zhi]!;
  const ss = cang.map((c) => shiShenYinYang(gz.gan as Gan, c));
  return { gan: gz.gan, zhi: gz.zhi, index: gz.index, cangGan: cang, shiShen: ss, nayin: nayin(gz.index) };
}

/** 藏干对日主的十神 */
export function shiShenToDayMaster(dayMaster: Gan, gan: Gan): string {
  return shiShenYinYang(dayMaster, gan);
}

// ---------- 神煞 ----------
const SAN_HE_GROUP: Record<string, string[]> = {
  申: ['申', '子', '辰'], 子: ['申', '子', '辰'], 辰: ['申', '子', '辰'],
  亥: ['亥', '卯', '未'], 卯: ['亥', '卯', '未'], 未: ['亥', '卯', '未'],
  寅: ['寅', '午', '戌'], 午: ['寅', '午', '戌'], 戌: ['寅', '午', '戌'],
  巳: ['巳', '酉', '丑'], 酉: ['巳', '酉', '丑'], 丑: ['巳', '酉', '丑'],
};

function groupOf(zhi: Zhi): string[] {
  return SAN_HE_GROUP[zhi]!;
}

/** 桃花 */
export function taoHua(zhi: Zhi): Zhi {
  const g = groupOf(zhi);
  const map: Record<string, Zhi> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
  return map[g[0]!]!;
}

/** 驿马 */
export function yiMa(zhi: Zhi): Zhi {
  const map: Record<string, Zhi> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  return map[zhi]!;
}

/** 文昌 */
export function wenChang(gan: Gan): Zhi {
  const map: Record<Gan, Zhi> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  return map[gan]!;
}

/** 羊刃 */
export function yangRen(gan: Gan): Zhi | null {
  const map: Record<string, Zhi> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
  return map[gan] ?? null;
}

/** 禄神 */
export function luShen(gan: Gan): Zhi {
  const map: Record<Gan, Zhi> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  return map[gan]!;
}

/** 将星/华盖 */
export function jiangXing(zhi: Zhi): Zhi {
  const map: Record<string, Zhi> = { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 巳: '酉', 酉: '酉', 丑: '酉', 亥: '卯', 卯: '卯', 未: '卯' };
  return map[zhi]!;
}
export function huaGai(zhi: Zhi): Zhi {
  const map: Record<string, Zhi> = { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未' };
  return map[zhi]!;
}

/** 天乙贵人 */
export function tianYi(gan: Gan): Zhi[] {
  const map: Record<string, Zhi[]> = {
    甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
    乙: ['子', '申'], 己: ['子', '申'],
    丙: ['亥', '酉'], 丁: ['亥', '酉'],
    壬: ['卯', '巳'], 癸: ['卯', '巳'],
    辛: ['午', '寅'],
  };
  return map[gan]!;
}

function computeShensha(chart: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }): Record<string, string[]> {
  const dm = chart.day.gan;
  const shensha: Record<string, string[]> = {};
  const allZhi = [chart.year.zhi, chart.month.zhi, chart.day.zhi, chart.hour.zhi];
  const dmZhi = chart.day.zhi;
  const th = taoHua(dmZhi);
  if (allZhi.includes(th)) shensha['桃花'] = [th];
  const ym = yiMa(dmZhi);
  if (allZhi.includes(ym)) shensha['驿马'] = [ym];
  const wc = wenChang(dm);
  if (allZhi.includes(wc)) shensha['文昌'] = [wc];
  const yr = yangRen(dm);
  if (yr && allZhi.includes(yr)) shensha['羊刃'] = [yr];
  const ls = luShen(dm);
  if (allZhi.includes(ls)) shensha['禄神'] = [ls];
  const jx = jiangXing(dmZhi);
  if (allZhi.includes(jx)) shensha['将星'] = [jx];
  const hg = huaGai(dmZhi);
  if (allZhi.includes(hg)) shensha['华盖'] = [hg];
  const ty = tianYi(dm);
  const tyHit = ty.filter((t) => allZhi.includes(t));
  if (tyHit.length) shensha['天乙贵人'] = tyHit;
  return shensha;
}

function dayMasterStrength(pillars: { month: Pillar; day: Pillar }): '强' | '中' | '弱' {
  const dm = pillars.day.gan;
  const dmWx = GAN_WUXING[dm];
  const monthWx = GAN_WUXING[pillars.month.gan];
  const monthZhiWx = ZHI_WUXING[pillars.month.zhi];
  // 得令（月令生扶）+ 日支 + 时支 简单打分
  let score = 0;
  if (monthWx === dmWx || (monthZhiWx === dmWx)) score += 2;
  const zhiWx = [pillars.month.zhi].map((z) => ZHI_WUXING[z]);
  if (zhiWx.includes(dmWx)) score += 1;
  return score >= 3 ? '强' : score === 2 ? '中' : '弱';
}

function makeBaziInput(ctx: EngineCtx): { year: number; month: number; day: number; hour: number; minute: number; second: number; gender: 'male' | 'female' } {
  const d = ctx.now;
  return {
    year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
    hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), gender: 'male',
  };
}

export async function buildBazi(
  input: { year: number; month: number; day: number; hour: number; minute?: number; second?: number; gender: 'male' | 'female' },
  config: BaziConfig = BAZI_DEFAULT_CONFIG,
  tzOffsetHours = 8,
): Promise<BaziChart> {
  const { year, month, day, hour, minute = 0, second = 0, gender } = input;
  const jd = dateToJd(year, month, day, hour + minute / 60 + second / 3600) - tzOffsetHours / 24;
  const jdn = civilJdn(year, month, day);

  // 年柱（立春换年）
  let yearPillar: GanZhi;
  if (config.yearSwitch === 'lichun') {
    const info = await monthPillarInfo(year, month, day, hour, tzOffsetHours);
    yearPillar = ganZhiFromIndex(info.yearGanZhiIndex);
  } else {
    // 正月初一换年：委托农历
    const { solarToLunar } = await import('../../calendar/lunar.js');
    const l = await solarToLunar(year, month, day, hour);
    const lunarYear = l.lunarMonth === 1 && l.lunarDay === 1 ? l.lunarYear : l.lunarYear - 1;
    yearPillar = ganZhiFromIndex(lunarYear - 4);
  }

  // 月柱
  let monthPillar: GanZhi;
  if (config.monthSwitch === 'jieqi') {
    monthPillar = await monthGanZhiOf(year, month, day, hour, tzOffsetHours);
  } else {
    const { solarToLunar } = await import('../../calendar/lunar.js');
    const l = await solarToLunar(year, month, day, hour);
    monthPillar = ganZhiFromIndex(l.monthGanZhiIndex);
  }

  // 日柱
  let dayIndex = dayGanZhiFromJdn(jdn).index;
  if (config.zishiSplit === '23:00' && hour >= 23) dayIndex = (dayIndex + 1) % 60;
  const dayPillar = ganZhiFromIndex(dayIndex);

  // 时柱
  const hourZhi = Math.floor((hour + 1) / 2) % 12;
  const hourPillar = hourGanZhi(dayIndex % 10, hourZhi);

  const yP = pillarOf(yearPillar);
  const mP = pillarOf(monthPillar);
  const dP = pillarOf(dayPillar);
  const hP = pillarOf(hourPillar);

  const qiyun = await computeQiYun(input, config, tzOffsetHours);

  const dayun: DaYun[] = [];
  const startAge = qiyun.age;
  for (let i = 0; i < 8; i++) {
    const gz = ganZhiFromIndex((qiyun.direction === '顺' ? monthPillar.index + 1 + i : monthPillar.index - 1 - i + 60 * 2) % 60);
    dayun.push({ startAge: startAge + i * 10, startYear: year + startAge + i * 10, ganZhi: gz, nayin: nayin(gz.index) });
  }

  const pillars = { year: yP, month: mP, day: dP, hour: hP };
  const shensha = computeShensha(pillars);
  const strength = dayMasterStrength(pillars);

  const normalized: NormalizedMoment = {
    year, month, day, hour, minute, second,
    jd, jdn,
    tzOffsetHours,
    dayGanZhiIndex: dayIndex,
    xunKong: xunKongOf(dayIndex).join(''),
  };

  return {
    art: 'bazi',
    year: yP, month: mP, day: dP, hour: hP,
    dayMaster: dP.gan,
    dayMasterStrength: strength,
    gender,
    qiyun,
    dayun,
    shensha,
    configHash: configHashOf({ ...config, gender, date: `${year}-${month}-${day} ${hour}:${minute}` }),
    normalized,
    config,
  };
}

/** 大运起运：阳男阴女顺行、阴男阳女逆行；3 天=1 岁、1 天=4 个月、1 时辰=10 天 */
async function computeQiYun(
  input: { year: number; month: number; day: number; hour: number; minute?: number; gender: 'male' | 'female' },
  config: BaziConfig,
  tzOffsetHours: number,
): Promise<{ direction: '顺' | '逆'; age: number; startYear: number; startMonth: number }> {
  const yearGz = ganZhiFromIndex(input.year - 4);
  const yang = TIANGAN.indexOf(yearGz.gan) % 2 === 0;
  const direction = (yang && input.gender === 'male') || (!yang && input.gender === 'female') ? '顺' : '逆';
  const jd = dateToJd(input.year, input.month, input.day, input.hour + (input.minute ?? 0) / 60) - tzOffsetHours / 24;
  void config;
  // 找最近的一个「节」（顺：下一个节；逆：上一个节）
  const terms = (await Promise.all([solarTermsOfYear(input.year - 1), solarTermsOfYear(input.year), solarTermsOfYear(input.year + 1)]))
    .flat()
    .filter((t) => t.jie)
    .sort((a, b) => a.jde - b.jde);
  let boundary = 0;
  if (direction === '顺') {
    boundary = terms.find((t) => t.jde > jd)?.jde ?? terms[terms.length - 1]!.jde;
  } else {
    const prev = [...terms].reverse().find((t) => t.jde < jd);
    boundary = prev?.jde ?? terms[0]!.jde;
  }
  const days = Math.abs(jd - boundary);
  const age = days / 3; // 3 天 = 1 岁
  const wholeAge = Math.floor(age * 100) / 100;
  const startYear = input.year + Math.floor(age);
  const startMonth = input.month + Math.floor((age - Math.floor(age)) * 12);
  return { direction, age: wholeAge, startYear, startMonth: ((startMonth - 1) % 12) + 1 };
}

export async function normalizeBazi(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
  const t = input.time
    ? { year: input.time.year, month: input.time.month, day: input.time.day, hour: input.time.hour, minute: input.time.minute ?? 0, second: input.time.second ?? 0 }
    : makeBaziInput(ctx);
  const jd = dateToJd(t.year, t.month, t.day, t.hour + t.minute / 60 + t.second / 3600) - tzOffsetHours / 24;
  const jdn = civilJdn(t.year, t.month, t.day);
  return {
    year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second,
    jd, jdn, tzOffsetHours,
    dayGanZhiIndex: dayGanZhiFromJdn(jdn).index,
    xunKong: xunKongOf(dayGanZhiFromJdn(jdn).index).join(''),
  };
}

export function pillarText(p: Pillar): string {
  return `${p.gan}${p.zhi}`;
}

export { DIZHI };
