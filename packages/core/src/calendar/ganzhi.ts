/**
 * 干支基础：天干、地支、五行、六十甲子、纳音、日柱锚点
 */

export const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export type Gan = (typeof TIANGAN)[number];
export type Zhi = (typeof DIZHI)[number];
export type WuXing = '木' | '火' | '土' | '金' | '水';

export const GAN_WUXING: Record<Gan, WuXing> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

export const ZHI_WUXING: Record<Zhi, WuXing> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 五行生克：生我 / 我生 / 克我 / 我克 / 同我 */
const SHENG: Record<WuXing, WuXing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<WuXing, WuXing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
export const WUXING_SHENG = SHENG;
export const WUXING_KE = KE;

export interface GanZhi {
  gan: Gan;
  zhi: Zhi;
  index: number; // 0..59
}

export function ganZhiFromIndex(index: number): GanZhi {
  const i = ((index % 60) + 60) % 60;
  return { gan: TIANGAN[i % 10]!, zhi: DIZHI[i % 12]!, index: i };
}

export function indexOfGanZhi(gan: Gan, zhi: Zhi): number {
  for (let i = 0; i < 60; i++) {
    if (TIANGAN[i % 10] === gan && DIZHI[i % 12] === zhi) return i;
  }
  throw new Error(`无效干支组合: ${gan}${zhi}`);
}

/** 年柱：以 (year-4) mod 60 为甲子序（配合立春换年判断使用）。 */
export function yearGanZhi(year: number): GanZhi {
  return ganZhiFromIndex(year - 4);
}

/**
 * 日柱：以 1984-02-02（丙寅日，lunar-javascript 交叉验证）为锚点，从儒略日整数取模。
 * 锚点校验：2000-01-01 应为 戊午（JDN 2451545）。
 */
export const DAY_ANCHOR_JDN = 2445733; // 1984-02-02 的儒略日数
export const DAY_ANCHOR_INDEX = 2;     // 丙寅 = 索引 2

export function dayGanZhiFromJdn(jdn: number): GanZhi {
  return ganZhiFromIndex(jdn - DAY_ANCHOR_JDN + DAY_ANCHOR_INDEX);
}

/** 五鼠遁：日干 → 子时天干；再按时辰地支递推。时干 = (日干%5*2 + 地支序) % 10 */
export function hourGanZhi(dayGanIndex: number, hourZhiIndex: number): GanZhi {
  const g = ((dayGanIndex % 5) * 2 + hourZhiIndex) % 10;
  const z = hourZhiIndex % 12;
  return { gan: TIANGAN[g]!, zhi: DIZHI[z]!, index: indexOfGanZhi(TIANGAN[g]!, DIZHI[z]!) };
}

/** 五虎遁：年干 → 正月(寅月)天干；月干 = (年干%5*2+2+月支序) % 10，月支序以寅=0 */
export function monthGanZhi(yearGanIndex: number, monthZhiIndexFromYin: number): GanZhi {
  const yinGan = ((yearGanIndex % 5) * 2 + 2) % 10;
  const g = (yinGan + monthZhiIndexFromYin) % 10;
  const z = (2 + monthZhiIndexFromYin) % 12;
  return { gan: TIANGAN[g]!, zhi: DIZHI[z]!, index: indexOfGanZhi(TIANGAN[g]!, DIZHI[z]!) };
}

/** 60 甲子纳音（30 对） */
const NAYIN: string[] = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
  '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金',
  '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
];

export function nayin(index: number): string {
  return NAYIN[Math.floor((((index % 60) + 60) % 60) / 2)]!;
}

/** 十二长生（阳干顺行/阴干逆行），用于旺衰参考 */
export const CHANGSHENG_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;

export function shiShen(dayGan: Gan, otherGan: Gan): string {
  const d = GAN_WUXING[dayGan];
  const o = GAN_WUXING[otherGan];
  if (o === d) return '比肩';
  if (SHENG[o] === d) return '偏印'; // 生我
  if (SHENG[d] === o) return '食神'; // 我生
  if (KE[o] === d) return '七杀'; // 克我
  if (KE[d] === o) return '偏财'; // 我克
  return '同';
}

export function shiShenYinYang(dayGan: Gan, otherGan: Gan): string {
  const di = TIANGAN.indexOf(dayGan);
  const oi = TIANGAN.indexOf(otherGan);
  const sameYinYang = di % 2 === oi % 2;
  const base = shiShen(dayGan, otherGan);
  const map: Record<string, [string, string]> = {
    比肩: ['比肩', '劫财'],
    偏印: ['偏印', '正印'],
    食神: ['食神', '伤官'],
    七杀: ['七杀', '正官'],
    偏财: ['偏财', '正财'],
  };
  const [yang, yin] = map[base]!;
  return sameYinYang ? yang : yin;
}

/** 地支六合：子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合 */
export const ZHI_LIUHE: Record<Zhi, Zhi> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
};

/** 地支六冲：子午、丑未、寅申、卯酉、辰戌、巳亥 */
export function zhiChong(zhi: Zhi): Zhi {
  return DIZHI[(DIZHI.indexOf(zhi) + 6) % 12]!;
}

/** 地支三合：申子辰合水、亥卯未合木、寅午戌合火、巳酉丑合金 */
export const ZHI_SANHE: Record<Zhi, Zhi[]> = {
  申: ['申', '子', '辰'], 子: ['申', '子', '辰'], 辰: ['申', '子', '辰'],
  亥: ['亥', '卯', '未'], 卯: ['亥', '卯', '未'], 未: ['亥', '卯', '未'],
  寅: ['寅', '午', '戌'], 午: ['寅', '午', '戌'], 戌: ['寅', '午', '戌'],
  巳: ['巳', '酉', '丑'], 酉: ['巳', '酉', '丑'], 丑: ['巳', '酉', '丑'],
};
