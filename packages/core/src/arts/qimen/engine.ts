/**
 * 奇门遁甲引擎（时家 · 转盘法，自研实现）
 * 原则（v8 §1.2）：「天盘值符随时干、人盘值使随时宫」三层盘局。
 * 排盘链路：
 *   1. 定局：节气（VSOP87 定气）＋ 符头定元（日柱六十甲子）→ 阴阳遁局数
 *   2. 地盘：三奇六仪「戊己庚辛壬癸丁丙乙」阳遁顺飞／阴遁逆飞
 *   3. 天盘：旬首六甲遁干 → 值符星随时干落宫，余星顺（阳）逆（阴）布
 *   4. 八门：值使门从旬首宫起，按时辰推移（阳顺阴逆，中五寄坤二）
 *   5. 八神：值符神在值符宫，阳遁顺行／阴遁逆行
 * 限定与简化（可复算、可测试）：
 *   - 仅「时间起局」（时家奇门），子时切分取 23:00（与八字一致）
 *   - 上中下元以「日柱符头定元」取拆补法常用表；节交接旬内的「超接置闰」不在本版
 *   - 中五寄坤二宫（门/神）；天盘寄五不另作伏位
 */

import type { EngineCtx, NormalizedMoment, RawInput } from '../../types.js';
import { civilJdn, dateToJd, deltaT } from '../../astronomy/jde.js';
import { dayGanZhiFromJdn, ganZhiFromIndex, hourGanZhi, monthGanZhi, DIZHI, type Gan, type WuXing, type Zhi } from '../../calendar/ganzhi.js';
import { solarTermsOfYear, type SolarTermName } from '../../calendar/solarTerms.js';
import { monthPillarInfo } from '../../calendar/monthPillar.js';
import { configHashOf } from '../../plugins/registry.js';
import { xunKongOf } from '../liuyao/trigrams.js';

// ---------------------------------------------------------------- 基础表

/** 九宫 → 方位 */
export const PALACE_DIRECTION: Record<number, '北' | '东北' | '东' | '东南' | '中' | '西北' | '西' | '西南' | '南'> = {
  1: '北', 2: '西南', 3: '东', 4: '东南', 5: '中', 6: '西北', 7: '西', 8: '东北', 9: '南',
};

/** 九宫 → 后天八卦 */
export const PALACE_BAGUA: Record<number, '坎' | '坤' | '震' | '巽' | '中' | '乾' | '兑' | '艮' | '离'> = {
  1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离',
};

/** 九宫 → 固定九星（地盘本位） */
export const FIXED_STAR: Record<number, string> = {
  1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英',
};

/** 九宫 → 固定八门（地盘本位；中五寄坤二） */
export const FIXED_DOOR: Record<number, string> = {
  1: '休', 2: '死', 3: '伤', 4: '杜', 5: '死(寄)', 6: '开', 7: '惊', 8: '生', 9: '景',
};

/** 八门沿八宫（含中五寄坤）的固定次序：休死伤杜｜开惊生景 ↔ 宫 1,2,3,4,6,7,8,9 */
const DOOR_ORDER = ['休', '死', '伤', '杜', '开', '惊', '生', '景'] as const;

/** 八神次序（阳遁顺行／阴遁逆行） */
const GOD_ORDER = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'] as const;

/** 三奇六仪（六甲遁干）：戊己庚辛壬癸丁丙乙 */
export const SIX_QI_YI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;

/** 六甲旬首：甲子/甲戌/甲申/甲午/甲辰/甲寅 */
export const XUN_NAMES = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'] as const;

/** 干 → 五行 */
export const STEM_WUXING: Record<Gan, WuXing> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

/** 二十四节气 → 阳遁三元局数（拆补法口诀：冬震一七四…） */
const YANG_DUN_JU: Record<string, [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6],
  立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8],
  立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
};

/** 二十四节气 → 阴遁三元局数 */
const YIN_DUN_JU: Record<string, [number, number, number]> = {
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4],
  立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2],
  立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};

/** 阳遁节气集合：冬至→芒种 */
const YANG_TERMS = new Set<SolarTermName>(['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种']);

/** 符头日（六十甲子内）：甲子(0) 己卯(15) 甲午(30) 己酉(45) */
const FU_TOU = [0, 15, 30, 45] as const;

/** 旬空支 → 宫（八宫各领若干支：子坎一、丑寅艮八、卯震三、辰巳巽四、午离九、未申坤二、酉兑七、戌亥乾六） */
const ZHI_PALACE: Record<Zhi, number> = {
  子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4,
  午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6,
};

// ---------------------------------------------------------------- 节气缓存

const termCache = new Map<number, Awaited<ReturnType<typeof solarTermsOfYear>>>();
async function termsFor(year: number): Promise<Awaited<ReturnType<typeof solarTermsOfYear>>> {
  let t = termCache.get(year);
  if (!t) {
    t = await solarTermsOfYear(year);
    termCache.set(year, t);
  }
  return t;
}

/** 找目标时刻「当前生效」的节气（含节与中气），并返回其交接 jde 与日 jdn */
export async function currentTermDetailOf(
  year: number, month: number, day: number, hour: number, tzOffsetHours = 8,
): Promise<{ term: SolarTermName; jde: number; jieJdn: number }> {
  const jdRaw = dateToJd(year, month, day, hour);
  const dateJde = jdRaw - tzOffsetHours / 24 + deltaT(jdRaw) / 86400;
  const [prev, cur, next] = await Promise.all([termsFor(year - 1), termsFor(year), termsFor(year + 1)]);
  const all = [...prev, ...cur, ...next].sort((a, b) => a.jde - b.jde);
  let term: SolarTermName = all[0]!.name;
  let jde = all[0]!.jde;
  for (const t of all) {
    if (t.jde <= dateJde) {
      term = t.name;
      jde = t.jde;
    } else break;
  }
  return { term, jde, jieJdn: termJdnOf(jde) };
}

/** 找目标时刻「当前生效」的节气名（含节与中气） */
export async function currentTermOf(year: number, month: number, day: number, hour: number, tzOffsetHours = 8): Promise<SolarTermName> {
  return (await currentTermDetailOf(year, month, day, hour, tzOffsetHours)).term;
}

// ---------------------------------------------------------------- 定局

/** 元类型：拆补法为上/中/下；置闰法的芒种/大雪可多出一个「闰上」 */
export type QimenYuan = '上' | '中' | '下' | '闰上';

/** 日柱六十甲子序 → 上中下元（符头定元：距最近符头 0-4 上元、5-9 中元、10-14 下元） */
export function yuanOf(dayIndex: number): '上' | '中' | '下' {
  const d = ((dayIndex % 60) + 60) % 60;
  let f = 0;
  for (const x of FU_TOU) if (x <= d) f = x;
  const offset = d - f;
  if (offset < 5) return '上';
  if (offset < 10) return '中';
  return '下';
}

/** 节气名 → 是否阳遁（冬至起至芒种为阳遁，夏至起至大雪为阴遁） */
export function isYangDun(term: SolarTermName): boolean {
  return YANG_TERMS.has(term);
}

/** 节气 + 元 → 局数（1-9；「闰上」与上元同局，仅天数多一轮） */
export function juOf(term: SolarTermName, yuan: QimenYuan, yang = true): number {
  const table = yang ? YANG_DUN_JU : YIN_DUN_JU;
  const entry = table[term];
  if (!entry) throw new Error(`无此节气三元局数：${term}`);
  const idx = yuan === '上' || yuan === '闰上' ? 0 : yuan === '中' ? 1 : 2;
  return entry[idx]!;
}

// ---------------------------------------------------------------- 置闰法（超神接气）

/**
 * 置闰窗口：仅阴阳遁转换点「芒种 / 大雪」两节可置闰。
 * 漂移阈值：上一符头日（甲子/己卯/甲午/己酉）距节气交接 ≥ 9 天视为「超神过甚」，须置闰。
 * 置闰后本节排布 20 天：上元 5 天 + 闰上元 5 天 + 中元 5 天 + 下元 5 天。
 */
export const RUAN_WINDOW: SolarTermName[] = ['芒种', '大雪'];
export const RUAN_THRESHOLD_DAYS = 9;

/** 节气交接 jde（力学时）→ 与引擎日柱同口径的整数日 jdn（UT 日；±1 天仅影响交接日附近） */
export function termJdnOf(jieJde: number): number {
  return Math.floor(jieJde - deltaT(jieJde) / 86400 + 0.5);
}

/**
 * 寻找不晚于节气交接日的「上一符头日」（甲子/己卯/甲午/己酉，向前≤40 步必得），
 * 返回：符头日 jdn、交接日距符头日天数（交接日当天计 0）。
 */
export function prevFuTouOf(jieJde: number): { futouJdn: number; daysBefore: number } {
  const jieJdn = termJdnOf(jieJde);
  for (let k = 0; k < 40; k++) {
    const jdn = jieJdn - k;
    const idx = dayGanZhiFromJdn(jdn).index;
    if (FU_TOU.includes(idx as never)) {
      return { futouJdn: jdn, daysBefore: jieJdn - jdn };
    }
  }
  return { futouJdn: jieJdn, daysBefore: 0 };
}

/** 是否触发置闰：仅芒种/大雪，且上一符头距节气交接 ≥ 阈值 */
export function zhiRunTriggered(term: SolarTermName, jieJde: number): boolean {
  if (!RUAN_WINDOW.includes(term)) return false;
  return prevFuTouOf(jieJde).daysBefore >= RUAN_THRESHOLD_DAYS;
}

/**
 * 置闰节内当前日所处段（交接日计第 1 天）：
 * 1-5 上元 / 6-10 闰上元 / 11-15 中元 / 16+ 下元。
 * dayJdn 为当前日用与引擎日柱同口径的 jdn，jieJdn 为节气交接日 jdn。
 */
export function zhiRunSegmentOf(dayJdn: number, jieJdn: number): QimenYuan {
  const offsetDays = dayJdn - jieJdn + 1;
  if (offsetDays <= 5) return '上';
  if (offsetDays <= 10) return '闰上';
  if (offsetDays <= 15) return '中';
  return '下';
}

// ---------------------------------------------------------------- 地盘

/**
 * 地盘三奇六仪布宫。
 * 阳遁：戊起局数宫顺飞；阴遁：戊起局数宫逆飞。返回 干→宫 映射。
 */
export function earthPalaces(ju: number, yang: boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < SIX_QI_YI.length; i++) {
    const p = yang ? ((ju - 1 + i) % 9) + 1 : (((ju - 1 - i) % 9) + 9) % 9 + 1;
    out[SIX_QI_YI[i]!] = p;
  }
  return out;
}

/** 反转查宫：宫 → 地盘干 */
export function earthStemOf(earth: Record<string, number>, palace: number): string {
  for (const [stem, p] of Object.entries(earth)) {
    if (p === palace) return stem;
  }
  return '';
}

/** 宫步进（九宫含中五）：阳顺／阴逆 */
function nextPalace9(p: number, yang: boolean): number {
  return yang ? (p % 9) + 1 : ((p - 1 + 8) % 9) + 1;
}

/** 八宫环（不含中五）：1,2,3,4,6,7,8,9 */
const RING8 = [1, 2, 3, 4, 6, 7, 8, 9];

/** 八宫环内步进（跳过中五） */
function ringNext(p: number, yang: boolean): number {
  const idx = RING8.indexOf(p === 5 ? 2 : p);
  return RING8[(idx + (yang ? 1 : -1) + 8) % 8]!;
}

// ---------------------------------------------------------------- 盘结构

export interface QimenPalace {
  num: number;
  bagua: string;
  direction: string;
  star: string;
  door: string;
  earthStem: string;
  heavenStem: string;
  god: string;
}

export interface QimenChart {
  art: 'qimen';
  method: string;
  year: string;   // 年柱干支
  month: string;  // 月柱干支
  day: string;    // 日柱干支
  hour: string;   // 时柱干支
  term: SolarTermName;          // 当前节气
  yangDun: boolean;             // 阳遁与否
  ju: number;                   // 局数 1-9
  yuan: QimenYuan;              // 上/中/下；置闰法可多「闰上」
  ruan: boolean;                // 本局是否处于置闰周期（置闰节内多排一个上元）
  ruanfa: 'chai' | 'zhi';       // 定局法：拆补法 / 置闰法
  xunShou: string;              // 旬首（甲子/甲戌…）
  xunShouYun: string;           // 旬首遁干（戊/己/庚/辛/壬/癸）
  valueStar: string;            // 值符星
  valueDoor: string;            // 值使门
  hourGan: Gan;                 // 时干（六甲时显化为旬首遁干）
  hourGanPalace: number;        // 时干落宫（地盘）
  dayGanPalace: number;         // 日干落宫（地盘）
  xunKong: string;              // 空亡二支
  xunKongPalaces: number[];     // 空亡对应宫
  fanyin: boolean;              // 反吟（值符落宫与旬首宫对冲）
  fuyin: boolean;               // 伏吟（值符星未动 / 值使门未动）
  palaces: QimenPalace[];       // 九宫，按 num 1..9
  normalized: NormalizedMoment;
  configHash: string;
}

/** 五行生我/我生（用于日宫-时宫生克速断） */
const SHENG: Record<WuXing, WuXing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<WuXing, WuXing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 日干落宫与事体落宫的五行关系：事体（时干宫）对测者（日干宫） */
export type RiShiRelation = '生我' | '我生' | '克我' | '我克' | '比和';
export function riShiRelationOf(dayWx: WuXing, shiWx: WuXing): RiShiRelation {
  if (shiWx === dayWx) return '比和';
  if (SHENG[shiWx] === dayWx) return '生我'; // 事生我
  if (SHENG[dayWx] === shiWx) return '我生'; // 我生事（泄）
  if (KE[shiWx] === dayWx) return '克我';   // 事克我
  return '我克';                             // 我克事
}

// ---------------------------------------------------------------- 排盘

export interface QimenConfig {
  engine: 'shijia';
  zishSplit: '23:00';
  /** 定局法：chai 拆补法（符头定元，默认）/ zhi 置闰法（芒种大雪超神过甚则闰上元） */
  ruanfa: 'chai' | 'zhi';
}

export const QIMEN_DEFAULT_CONFIG: QimenConfig = { engine: 'shijia', zishSplit: '23:00', ruanfa: 'chai' };

/**
 * 以四柱与定局信息构建全盘。
 * 参数显式传入以便黄金样本直接验证（不依赖节气表的真实日期）。
 */
export function buildQimenChart(p: {
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;
  dayIndex: number;   // 0-59
  hourIndex: number;  // 0-59
  term: SolarTermName;
  yangDun: boolean;
  ju: number;
  yuan: QimenYuan;
  ruan?: boolean;          // 本局是否处于置闰周期
  normalized: NormalizedMoment;
  config: QimenConfig;
  method?: string;
}): QimenChart {
  const { ju, yang } = { ju: p.ju, yang: p.yangDun };
  const earth = earthPalaces(ju, yang);

  // 旬首
  const xunIdx = Math.floor(p.hourIndex / 10);
  const xunShou = XUN_NAMES[xunIdx]!;
  const xunShouYun = SIX_QI_YI[xunIdx]!;   // 甲子戊、甲戌己…
  const xunPalace = earth[xunShouYun]!;
  const valueStar = FIXED_STAR[xunPalace]!;
  const valueDoorName = FIXED_DOOR[xunPalace]!;

  // 时干（六甲时显化旬首遁干）与其地盘落宫
  const hourGanRaw = p.hourPillar[0] as Gan;
  const isJiaShi = hourGanRaw === '甲';
  const hourGan = isJiaShi ? (xunShouYun as Gan) : hourGanRaw;
  const hourGanPalace = earth[hourGan] ?? xunPalace;
  const t = hourGanPalace;   // 值符落宫（时干宫）
  const f0 = xunPalace;      // 旬首宫（值符星本位）

  // 天盘：值符星 f0→t，其余星按阳顺阴逆沿九宫（含中五）转布
  const starOf: Record<number, string> = {};
  const heavenOf: Record<number, string> = {};
  for (let palace = 1; palace <= 9; palace++) {
    const k = yang ? (palace - t + 9) % 9 : (t - palace + 9) % 9;
    const g = yang ? ((f0 - 1 + k) % 9) + 1 : (((f0 - 1 - k) % 9) + 9) % 9 + 1;
    starOf[palace] = FIXED_STAR[g]!;
    heavenOf[palace] = earthStemOf(earth, g) || '';
  }

  // 八门：值使门从旬首宫起，每辰移一宫（阳顺阴逆，中五寄坤），再以飞宫序布全盘
  const doorSteps = p.hourIndex % 10;
  const doorStart = f0 === 5 ? 2 : f0;
  const doorLeadIdx = DOOR_ORDER.indexOf((valueDoorName === '死(寄)' ? '死' : valueDoorName) as (typeof DOOR_ORDER)[number]);
  let v = doorStart;
  for (let i = 0; i < doorSteps; i++) v = ringNext(v, yang);
  const doorOf: Record<number, string> = { 5: '死(寄)' };
  {
    let cursor = v;
    for (let j = 0; j < 8; j++) {
      doorOf[cursor] = DOOR_ORDER[(doorLeadIdx + (j * (yang ? 1 : -1) + 8) % 8 + 8) % 8]!;
      cursor = ringNext(cursor, yang);
    }
  }

  // 八神：值符神在值符宫（时干宫），阳遁顺行／阴遁逆行（中五寄坤）
  const godStart = t === 5 ? 2 : t;
  const godOf: Record<number, string> = {};
  {
    let cursor = godStart;
    for (let j = 0; j < 8; j++) {
      godOf[cursor] = GOD_ORDER[j]!;
      cursor = ringNext(cursor, yang);
    }
  }

  // 日干落宫（地盘；日干为甲时遁于日旬首之仪，与「六甲遁干」同理）
  const dayGan = p.dayPillar[0] as Gan;
  const dayGanEffective = dayGan === '甲' ? (SIX_QI_YI[Math.floor(p.dayIndex / 10)] as Gan) : dayGan;
  const dayGanPalace = earth[dayGanEffective] ?? 0;

  // 空亡：时柱旬空二支 → 对应宫
  const xunKong = xunKongOf(p.hourIndex).join('');
  const xunKongPalaces = [...xunKong].map((z) => ZHI_PALACE[z as Zhi]!).filter((v, i, a) => a.indexOf(v) === i);

  // 反吟／伏吟
  const duiChong = (a: number, b: number) => a + b === 10;
  const fanyin = duiChong(t, f0);
  const fuyin = t === f0;

  const palaces: QimenPalace[] = [];
  for (let num = 1; num <= 9; num++) {
    palaces.push({
      num,
      bagua: PALACE_BAGUA[num]!,
      direction: PALACE_DIRECTION[num]!,
      star: starOf[num]!,
      door: doorOf[num] ?? FIXED_DOOR[num]!,
      earthStem: earthStemOf(earth, num) || '—',
      heavenStem: heavenOf[num] || '—',
      god: num === 5 ? '—' : godOf[num]!,
    });
  }

  const configHash = configHashOf({ ...p.config, date: `${p.normalized.year}-${p.normalized.month}-${p.normalized.day} ${p.normalized.hour}:${p.normalized.minute}` });

  return {
    art: 'qimen',
    method: p.method ?? `时间起局（${p.term}，${p.yangDun ? '阳' : '阴'}遁${p.ju}局）`,
    year: p.yearPillar,
    month: p.monthPillar,
    day: p.dayPillar,
    hour: p.hourPillar,
    term: p.term,
    yangDun: p.yangDun,
    ju: p.ju,
    yuan: p.yuan,
    ruan: p.ruan ?? false,
    ruanfa: p.config.ruanfa,
    xunShou,
    xunShouYun,
    valueStar,
    valueDoor: valueDoorName,
    hourGan,
    hourGanPalace,
    dayGanPalace,
    xunKong,
    xunKongPalaces,
    fanyin,
    fuyin,
    palaces,
    normalized: p.normalized,
    configHash,
  };
}

/** 归一化时刻（与梅花/六爻一致） */
export async function normalizeQimen(input: RawInput, ctx: EngineCtx, tzOffsetHours = 8): Promise<NormalizedMoment> {
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

/** 时家奇门排盘（时间起局） */
export async function castQimen(input: RawInput, ctx: EngineCtx, config: QimenConfig = QIMEN_DEFAULT_CONFIG): Promise<QimenChart> {
  if (input.kind !== 'time') {
    throw new Error('奇门遁甲仅支持「时间起局」：请选择时间起局');
  }
  const norm = await normalizeQimen(input, ctx, ctx.tzOffsetHours ?? 8);
  const { year, month, day, hour } = norm;

  // 四柱（立春换年 / 节令换月，与八字一致）
  const info = await monthPillarInfo(year, month, day, hour, norm.tzOffsetHours);
  const yearPillarGz = ganZhiFromIndex(info.yearGanZhiIndex);
  const monthZhiIndex = DIZHI.indexOf(info.monthZhi);
  const monthPillarGz = monthGanZhi(info.yearGanZhiIndex, ((monthZhiIndex - 2) % 12 + 12) % 12);

  let dayIndex = dayGanZhiFromJdn(norm.jdn).index;
  if (config.zishSplit === '23:00' && hour >= 23) dayIndex = (dayIndex + 1) % 60;
  const dayGz = ganZhiFromIndex(dayIndex);
  const hourZhiIndex = Math.floor((hour + 1) / 2) % 12;
  const hourGz = hourGanZhi(dayIndex % 10, hourZhiIndex);

  // 定局
  const { term, jde: termJde, jieJdn: termJieJdn } = await currentTermDetailOf(year, month, day, hour, norm.tzOffsetHours);
  const yangDun = isYangDun(term);
  const ruanfa = config.ruanfa;
  let yuan: QimenYuan;
  let ruan = false;
  if (ruanfa === 'zhi') {
    // 置闰法：仅芒种/大雪在「超神过甚」时闰上元；否则回退符头定元
    const triggered = zhiRunTriggered(term, termJde);
    if (triggered) {
      ruan = true;
      yuan = zhiRunSegmentOf(norm.jdn, termJieJdn);
    } else {
      yuan = yuanOf(dayIndex);
    }
  } else {
    yuan = yuanOf(dayIndex);
  }
  const ju = juOf(term, yuan, yangDun);

  return buildQimenChart({
    yearPillar: yearPillarGz.gan + yearPillarGz.zhi,
    monthPillar: monthPillarGz.gan + monthPillarGz.zhi,
    dayPillar: dayGz.gan + dayGz.zhi,
    hourPillar: hourGz.gan + hourGz.zhi,
    dayIndex,
    hourIndex: hourGz.index,
    term,
    yangDun,
    ju,
    yuan,
    ruan,
    normalized: norm,
    config,
  });
}
