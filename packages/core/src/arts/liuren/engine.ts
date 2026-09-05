/**
 * 大六壬引擎（自研实现）
 * 框架（v8 §1.2）：「月将加时」起天盘，四课三传为课体；侧重方位时机与来意。
 * 排盘链路：
 *   1. 地盘：十二地支固定（子→亥）
 *   2. 天盘：「月将 + 占时」（月将为节气月支之六合支，属通行口诀「正月登明、二月河魁…」）
 *   3. 四课：干寄宫起第一二课，日支起第三四课（上神逐课递推）
 *   4. 三传：九宗门（伏吟/返吟/贼克/比用/涉害/遥克/昴星/别责/八专）取初传；中末传取初传三合局环序顺数二支
 *   5. 十二天将：昼夜贵人定贵人支，阳贵顺布／阴贵逆布
 * 简化与流派说明（可复算、可测试）：
 *   - 涉害、昴星、别责、八专按确定性简化取神（见各函数注释），一律 D 级「流派说法」且断语明示简化
 *   - 昼夜贵人以占时支（卯→申为昼）判定；贵人顺逆以阳贵顺行／阴贵逆行为准
 *   - 月将以节气月支六合取（与「太阳过宫」传统口径在多数情形一致）
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { civilJdn, dateToJd } from '../../astronomy/jde.js';
import {
  DIZHI, ZHI_LIUHE, ZHI_SANHE, zhiChong, ZHI_WUXING, GAN_WUXING, WUXING_SHENG, WUXING_KE,
  dayGanZhiFromJdn, ganZhiFromIndex, hourGanZhi, monthGanZhi,
  type Gan, type WuXing, type Zhi,
} from '../../calendar/ganzhi.js';
import { monthPillarInfo } from '../../calendar/monthPillar.js';
import { configHashOf } from '../../plugins/registry.js';
import { xunKongOf } from '../liuyao/trigrams.js';

/** 十二支环序（子0..亥11） */
export const BRANCH_RING = [...DIZHI] as const;

/** 天干寄宫（地盘支）：甲寅 乙辰 丙巳 丁未 戊巳 己未 庚申 辛戌 壬亥 癸丑 */
export const STEM_HOME: Record<Gan, Zhi> = {
  甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳',
  己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑',
};

/** 昼夜贵人（口诀：甲戊庚牛羊 乙己鼠猴 丙丁猪鸡 壬癸兔蛇 六辛马虎） */
export const GUI_REN: Record<Gan, { day: Zhi; night: Zhi }> = {
  甲: { day: '丑', night: '未' },
  戊: { day: '丑', night: '未' },
  庚: { day: '丑', night: '未' },
  乙: { day: '子', night: '申' },
  己: { day: '子', night: '申' },
  丙: { day: '亥', night: '酉' },
  丁: { day: '亥', night: '酉' },
  壬: { day: '卯', night: '巳' },
  癸: { day: '卯', night: '巳' },
  辛: { day: '午', night: '寅' },
};

/** 十二天将（贵人起顺次布十二支） */
export const TWELVE_GODS = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'] as const;

/** 用神取法（九宗门）门类标识 */
export type ChuChuanGate = '伏吟' | '返吟' | '贼克' | '比用' | '涉害' | '遥克' | '昴星(简化)' | '别责(简化)' | '八专';

/** 支五行生我/我生（用于贼克比对） */
function shengOf(wx: WuXing): WuXing {
  return WUXING_SHENG[wx];
}
function keOf(wx: WuXing): WuXing {
  return WUXING_KE[wx];
}

/** 支 → 五行 */
function zhiWx(z: string): WuXing {
  return ZHI_WUXING[z as Zhi]!;
}

/** 天盘：月将支加占时支，顺布十二支。返回 地盘支→天盘支 映射 */
export function heavenPlate(monthJiang: Zhi, shiZhi: Zhi): Record<Zhi, Zhi> {
  const jIdx = DIZHI.indexOf(monthJiang);
  const sIdx = DIZHI.indexOf(shiZhi);
  const offset = ((sIdx - jIdx) % 12 + 12) % 12;
  const out = {} as Record<Zhi, Zhi>;
  for (let i = 0; i < 12; i++) {
    const b = DIZHI[i]!;
    out[b] = DIZHI[(i + offset) % 12]!;
  }
  return out;
}

/** 伏吟：天盘支全同地盘支（占时支 == 月将支） */
export function isFuYin(heaven: Record<Zhi, Zhi>): boolean {
  return DIZHI.every((b) => heaven[b] === b);
}

/** 返吟：天盘支随地盘支全冲（占时支为月将之冲支） */
export function isFanYin(heaven: Record<Zhi, Zhi>): boolean {
  return DIZHI.every((b) => heaven[b] === zhiChong(b));
}

export interface KeCell {
  index: number;      // 1..4
  lower: Zhi;         // 地盘支（课下）
  upper: Zhi;         // 天盘支（课上神）
  relation: '上克下' | '下贼上' | '比和';
}

export interface GuiGod {
  branch: Zhi;        // 十二支位
  god: string;        // 十二天将
}

export interface LiuRenChart {
  art: 'liuren';
  method: string;
  year: string;       // 年柱
  month: string;      // 月柱
  day: string;        // 日柱
  hour: string;       // 时柱
  dayGan: Gan;
  dayZhi: Zhi;
  monthJiang: Zhi;    // 月将支
  shiZhi: Zhi;        // 占时支
  heaven: Record<Zhi, Zhi>; // 地盘支→天盘支
  ke: KeCell[];       // 四课
  chuChuanGate: ChuChuanGate;
  chuChuan: Zhi;      // 初传（用神）
  zhongChuan: Zhi;    // 中传
  moChuan: Zhi;       // 末传
  fuYin: boolean;
  fanYin: boolean;
  guiRen: Zhi;        // 贵人支
  isDayGui: boolean;  // 昼贵与否
  guiGods: GuiGod[];  // 十二天将布支
  yiMa: Zhi;          // 驿马
  xunKong: string;    // 旬空（二字）
  xunKongBranches: Zhi[]; // 旬空支
  configHash: string;
  normalized: NormalizedMoment;
}

/** 三奇/宝/骄不用——本引擎不参与；此表仅说明四课上下生克关系判定 */
function keRelation(lower: Zhi, upper: Zhi): KeCell['relation'] {
  const l = zhiWx(lower);
  const u = zhiWx(upper);
  if (keOf(u) === l) return '上克下';
  if (keOf(l) === u) return '下贼上';
  return '比和';
}

/** 干阴阳（阳干甲丙戊庚壬）与支阴阳 */
function ganYang(gan: Gan): boolean {
  return ['甲', '丙', '戊', '庚', '壬'].includes(gan);
}
function zhiYang(z: Zhi): boolean {
  return ['子', '寅', '辰', '午', '申', '戌'].includes(z);
}

/** 孟仲季位：孟（寅申巳亥）＞仲（子午卯酉）＞季（辰戌丑未） */
function mengZhongJi(z: Zhi): 0 | 1 | 2 {
  if (['寅', '申', '巳', '亥'].includes(z)) return 0;
  if (['子', '午', '卯', '酉'].includes(z)) return 1;
  return 2;
}

/** 地盘诸宫所寄天干（涉害以支神及所寄天干分计克害点；子午卯酉四正无寄） */
const JI_GAN: Partial<Record<Zhi, Gan[]>> = {
  寅: ['甲'], 辰: ['乙'], 巳: ['丙', '戊'], 未: ['丁', '己'],
  申: ['庚'], 戌: ['辛'], 亥: ['壬'], 丑: ['癸'],
};

/**
 * 涉害法（《六壬大全·课经》《六壬粹言·毕法补谈》权威取法，已联网核对）：
 * 「涉害行来本家止，多克便将用为起」——候选上神自其天盘所临宫位之「下一宫」起，
 * 顺行至其「地盘本家」止（含本家），逐位计「受地盘支神及其所寄天干之克」；
 * 支神克该神计 1 点，所寄天干克该神逐字各计 1 点；受克深者（涉害多者）为初传。
 * 验例：《粹言》丁卯日三课丑加卯「前行历乙木一重」、四课亥加丑「前行历辰戊未己戌土五重」。
 */
export function sheHaiDepthOf(c: Zhi, heaven: Record<Zhi, Zhi>): number {
  const start = DIZHI.findIndex((b) => heaven[b] === c);
  if (start < 0) return 0;
  const home = DIZHI.indexOf(c);
  let p = (start + 1) % 12; // 自临位之下一宫起数
  let depth = 0;
  for (let step = 0; step <= 12; step++) {
    const zh = DIZHI[p]!;
    if (keOf(zhiWx(zh)) === zhiWx(c)) depth += 1; // 地盘支神克该神
    for (const g of JI_GAN[zh] ?? []) {
      if (keOf(GAN_WUXING[g]) === zhiWx(c)) depth += 1; // 所寄天干克该神
    }
    if (p === home) break; // 含本家止
    p = (p + 1) % 12;
  }
  return depth;
}

export function pickSheHai(
  bi: Array<{ lower: Zhi; upper: Zhi }>,
  heaven: Record<Zhi, Zhi>,
  dayGan: Gan,
  dayZhi: Zhi,
): { gate: ChuChuanGate; zhi: Zhi } {
  // 涉多者（受克深）为用；同深则「见机」取四孟位上神、次「察微」取四仲位上神；
  // 孟仲俱等（复等）则刚日取日干上神、柔日取日支上神；未命中取课序先见者。
  const linWeiOf = (upper: Zhi): number => {
    const s = DIZHI.findIndex((b) => heaven[b] === upper);
    return s < 0 ? 2 : mengZhongJi(DIZHI[s]!);
  };
  const ranked = bi
    .map((c) => ({ c, depth: sheHaiDepthOf(c.upper, heaven), meng: linWeiOf(c.upper) }))
    .sort((a, b) => b.depth - a.depth || a.meng - b.meng);
  const deepest = ranked[0]!;
  const rivals = ranked.filter((r) => r.depth === deepest.depth && r.meng === deepest.meng);
  // 复等：刚日取日干上神、柔日取日支上神（柔辰刚日）
  const tieTarget = ganYang(dayGan) ? heaven[STEM_HOME[dayGan]] : heaven[dayZhi];
  const pick = rivals.find((r) => r.c.upper === tieTarget) ?? rivals[0]!;
  return { gate: '涉害', zhi: pick.c.upper };
}

/**
 * 三传取初传（九宗门核心链，含确定性简化）。
 * 宗法次序：八专（干支同支）→ 伏吟 → 贼克/比用/涉害 → 遥克 → 昴星 → 别责。
 * 返吟若有贼克仍先审贼克，无克方取对冲支上神。
 */
export function chuChuanOf(
  ke: Array<{ lower: Zhi; upper: Zhi; relation: KeCell['relation'] }>,
  dayGan: Gan,
  dayZhi: Zhi,
  heaven: Record<Zhi, Zhi>,
  fuYin: boolean,
  fanYin: boolean,
): { gate: ChuChuanGate; zhi: Zhi } {
  // 伏吟：天盘不动，取干寄宫支（本身）为用神，标记伏吟
  if (fuYin) {
    return { gate: '伏吟', zhi: STEM_HOME[dayGan] };
  }
  // 八专：干支同宫（干寄宫=日支），四课两两重复；阳日干上神顺数三辰、阴日干上神逆数三辰（含起点）
  if (ke.length > 2 && ke[0]!.lower === ke[2]!.lower) {
    const home = ke[0]!.lower;
    const offset = ganYang(dayGan) ? 2 : -2;
    const zhi = DIZHI[(DIZHI.indexOf(heaven[home]) + offset + 12) % 12]!;
    return { gate: '八专', zhi };
  }

  // 贼克：下贼上优先，其次上克下
  const zei = ke.filter((c) => c.relation === '下贼上');
  const keList = ke.filter((c) => c.relation === '上克下');
  const candidates = zei.length > 0 ? zei : keList;
  if (candidates.length === 1) {
    return { gate: '贼克', zhi: candidates[0]!.upper };
  }
  if (candidates.length > 1) {
    // 比用：取与日干阴阳相同者
    const bi = candidates.filter((c) => zhiYang(c.upper) === ganYang(dayGan));
    if (bi.length === 1) return { gate: '比用', zhi: bi[0]!.upper };
    if (bi.length > 1) {
      return pickSheHai(bi, heaven, dayGan, dayZhi);
    }
    // 无比用者：按四课次序取最近者（下贼课优先已保证）
    return { gate: '涉害', zhi: candidates[0]!.upper };
  }

  // 返吟：四课无克时，取日支对冲之上神
  if (fanYin) {
    return { gate: '返吟', zhi: heaven[zhiChong(dayZhi)] };
  }

  // 遥克：先取「日干遥克之上神」（日干克神），无则取「神克日干」者
  const ganWx = GAN_WUXING[dayGan];
  const dayKeGod = ke.filter((c) => keOf(ganWx) === zhiWx(c.upper));   // 日干克神
  if (dayKeGod.length === 1) return { gate: '遥克', zhi: dayKeGod[0]!.upper };
  if (dayKeGod.length > 1) {
    const bi = dayKeGod.find((c) => zhiYang(c.upper) === ganYang(dayGan)) ?? dayKeGod[0]!;
    return { gate: '遥克', zhi: bi.upper };
  }
  const godKeDay = ke.find((c) => keOf(zhiWx(c.upper)) === ganWx);     // 神克日干
  if (godKeDay) return { gate: '遥克', zhi: godKeDay.upper };

  // 昴星：阳日取酉之上神；阴日取天盘辰所临之地盘支（俯视），仍标简化
  if (ganYang(dayGan)) {
    return { gate: '昴星(简化)', zhi: heaven['酉'] };
  }
  const yinStar = DIZHI.find((b) => heaven[b] === '辰') ?? '辰';
  return { gate: '昴星(简化)', zhi: yinStar };
}

/** 中末传：初传三合局环序顺数二支（环序 申子辰 ／ 亥卯未 ／ 寅午戌 ／ 巳酉丑） */
export function zhongMoOf(chu: Zhi): { zhong: Zhi; mo: Zhi } {
  const group = ZHI_SANHE[chu]! as Zhi[];
  // 以「申子辰」这类环序，从初传起顺数二支
  const idx = group.indexOf(chu);
  return { zhong: group[(idx + 1) % 3]!, mo: group[(idx + 2) % 3]! };
}

/** 贵人支（昼夜由占时支卯→申为昼） */
export function guiRenOf(dayGan: Gan, shiZhi: Zhi): { branch: Zhi; isDay: boolean } {
  const isDay = DIZHI.indexOf(shiZhi) >= 4 && DIZHI.indexOf(shiZhi) <= 9; // 卯..申
  const g = GUI_REN[dayGan];
  return isDay ? { branch: g.day, isDay: true } : { branch: g.night, isDay: false };
}

/** 十二天将布支：贵人支起，阳贵（昼）顺行／阴贵（夜）逆行 */
export function guiGodsOf(guiRen: Zhi, isDay: boolean): GuiGod[] {
  const start = DIZHI.indexOf(guiRen);
  const out: GuiGod[] = [];
  for (let i = 0; i < 12; i++) {
    const pos = ((start + (isDay ? i : -i)) % 12 + 12) % 12;
    out.push({ branch: DIZHI[pos]!, god: TWELVE_GODS[i]! });
  }
  return out;
}

/** 驿马（申子辰马在寅等） */
export function yiMaOf(zhi: Zhi): Zhi {
  const map: Record<Zhi, Zhi> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  return map[zhi]!;
}

/** 归一化时刻（与奇门/梅花一致） */
export async function normalizeLiuRen(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
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

/** 大六壬排盘（时间起课） */
export async function castLiuRen(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<LiuRenChart> {
  if (input.kind !== 'time') {
    throw new Error('大六壬仅支持「时间起课」：请选择时间起局');
  }
  const norm = await normalizeLiuRen(input, ctx, tzOffsetHours);
  const { year, month, day, hour } = norm;

  // 四柱（立春换年 / 节令换月，与八字一致）
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
  const dayZhi = dayGz.zhi as Zhi;
  const shiZhi = DIZHI[shiZhiIndex]!;

  // 月将 = 节气月支之六合支；天盘 = 月将加占时
  const monthJiang = ZHI_LIUHE[info.monthZhi]!;
  const heaven = heavenPlate(monthJiang, shiZhi);

  // 四课
  const g1Upper = heaven[STEM_HOME[dayGan]];
  const g2Upper = heaven[g1Upper];
  const g3Upper = heaven[dayZhi];
  const g4Upper = heaven[g3Upper];
  const ke: KeCell[] = [
    { index: 1, lower: STEM_HOME[dayGan], upper: g1Upper, relation: keRelation(STEM_HOME[dayGan], g1Upper) },
    { index: 2, lower: g1Upper, upper: g2Upper, relation: keRelation(g1Upper, g2Upper) },
    { index: 3, lower: dayZhi, upper: g3Upper, relation: keRelation(dayZhi, g3Upper) },
    { index: 4, lower: g3Upper, upper: g4Upper, relation: keRelation(g3Upper, g4Upper) },
  ];

  const fuYin = isFuYin(heaven);
  const fanYin = isFanYin(heaven);
  const { gate, zhi: chu } = chuChuanOf(ke, dayGan, dayZhi, heaven, fuYin, fanYin);
  // 八专三传：中传取干上神、末传取支上神（干支同宫时二者同支）；其余按三合
  const { zhong, mo } = gate === '八专'
    ? { zhong: heaven[STEM_HOME[dayGan]], mo: heaven[dayZhi] }
    : zhongMoOf(chu);

  const { branch: guiRen, isDay: isDayGui } = guiRenOf(dayGan, shiZhi);
  const guiGods = guiGodsOf(guiRen, isDayGui);

  const xunKong = xunKongOf(dayIndex).join('');
  const xunKongBranches = [...xunKong] as Zhi[];

  const configHash = configHashOf({ monthJiang, shiZhi, date: `${year}-${month}-${day} ${hour}:${norm.minute}` });

  return {
    art: 'liuren',
    method: `时间起课（月将${monthJiang}加占时${shiZhi}）`,
    year: yearPillarGz.gan + yearPillarGz.zhi,
    month: monthPillarGz.gan + monthPillarGz.zhi,
    day: dayGz.gan + dayGz.zhi,
    hour: hourGz.gan + hourGz.zhi,
    dayGan,
    dayZhi,
    monthJiang,
    shiZhi,
    heaven,
    ke,
    chuChuanGate: gate,
    chuChuan: chu,
    zhongChuan: zhong,
    moChuan: mo,
    fuYin,
    fanYin,
    guiRen,
    isDayGui,
    guiGods,
    yiMa: yiMaOf(dayZhi),
    xunKong,
    xunKongBranches,
    configHash,
    normalized: norm,
  };
}
