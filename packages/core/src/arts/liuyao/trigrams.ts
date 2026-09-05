/**
 * 六爻基础：八卦、八宫生成、世应、纳甲、六亲、六神
 * 算法依据：《卜筮正宗》《增删卜易》通行排盘规则
 */

import type { Gan } from '../../calendar/ganzhi.js';

/** 三爻卦：自下而上 [初, 二, 三]，1=阳 0=阴 */
export const TRIGRAMS: Record<string, [number, number, number]> = {
  乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0],
  巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0],
};

/** 三爻卦名（顺序固定：乾兑离震巽坎艮坤） */
export const TRIGRAM_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'] as const;
export type TrigramName = (typeof TRIGRAM_NAMES)[number];

export const TRIGRAM_INDEX: Record<string, number> = { 乾: 0, 兑: 1, 离: 2, 震: 3, 巽: 4, 坎: 5, 艮: 6, 坤: 7 };

/** 纳甲干支（内/外卦干） */
export const NAJIA_STEMS: Record<TrigramName, { inner: Gan; outer: Gan }> = {
  乾: { inner: '甲', outer: '壬' },
  坤: { inner: '乙', outer: '癸' },
  震: { inner: '庚', outer: '庚' },
  巽: { inner: '辛', outer: '辛' },
  坎: { inner: '戊', outer: '戊' },
  离: { inner: '己', outer: '己' },
  艮: { inner: '丙', outer: '丙' },
  兑: { inner: '丁', outer: '丁' },
};

/** 纳甲地支（六爻，初→上） */
export const NAJIA_BRANCHES: Record<TrigramName, string[]> = {
  乾: ['子', '寅', '辰', '午', '申', '戌'],
  坎: ['寅', '辰', '午', '申', '戌', '子'],
  艮: ['辰', '午', '申', '戌', '子', '寅'],
  震: ['子', '寅', '辰', '午', '申', '戌'],
  巽: ['丑', '亥', '酉', '未', '巳', '卯'],
  离: ['卯', '丑', '亥', '酉', '未', '巳'],
  兑: ['巳', '卯', '丑', '亥', '酉', '未'],
  坤: ['未', '巳', '卯', '丑', '亥', '酉'],
};

/** 宫五行（六亲基准） */
export const GONG_WUXING: Record<TrigramName, '金' | '木' | '水' | '火' | '土'> = {
  乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土',
};

const ZHI_WX: Record<string, '金' | '木' | '水' | '火' | '土'> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

export type LiuQin = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';

const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/**
 * 六亲：以宫五行为「我」——
 *  同我兄弟 / 生我父母（支生宫）/ 我生子孙（宫生支）/ 克我官鬼（支克宫）/ 我克妻财（宫克支）
 */
export function liuQin(gong: TrigramName, zhi: string): LiuQin {
  const g = GONG_WUXING[gong];
  const z = ZHI_WX[zhi]!;
  if (g === z) return '兄弟';
  if (SHENG[z] === g) return '父母'; // 支生宫
  if (SHENG[g] === z) return '子孙'; // 宫生支
  if (KE[z] === g) return '官鬼';   // 支克宫
  return '妻财';                     // 宫克支
}

/** 六神顺序 */
export const LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'] as const;
export type LiuShen = (typeof LIU_SHEN)[number];

/** 日干 → 初爻六神起点 */
export function liuShenStart(dayGan: Gan): LiuShen {
  switch (dayGan) {
    case '甲': case '乙': return '青龙';
    case '丙': case '丁': return '朱雀';
    case '戊': return '勾陈';
    case '己': return '螣蛇';
    case '庚': case '辛': return '白虎';
    case '壬': case '癸': return '玄武';
  }
}

export function liuShenOf(dayGan: Gan, lineIndex: number): LiuShen {
  const start = LIU_SHEN.indexOf(liuShenStart(dayGan));
  return LIU_SHEN[(start + lineIndex) % 6]!;
}

/** 世应位（0=初爻 … 5=上爻） */
export const SHI_YING: Record<string, [number, number]> = {
  ben: [5, 2], // 八纯
  shi1: [0, 3],
  shi2: [1, 4],
  shi3: [2, 5],
  shi4: [3, 0],
  shi5: [4, 1],
  youhun: [3, 0],
  guihun: [2, 5],
};

/** 世类名 */
export const SHI_CLASS_NAMES = ['八纯', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'] as const;
export type ShiClass = (typeof SHI_CLASS_NAMES)[number];

export interface HexagramInfo {
  /** 六爻（初→上） */
  lines: [number, number, number, number, number, number];
  upper: TrigramName;
  lower: TrigramName;
  name: string;
  gong: TrigramName;         // 宫
  gongWuxing: string;
  shiClass: ShiClass;
  shiIndex: number;          // 0..5
  yingIndex: number;         // 0..5
  /** 每爻：纳干 + 地支 */
  najia: Array<{ stem: Gan; branch: string }>;
  /** 每爻六亲 */
  liuqin: LiuQin[];
}

/** 翻转爻位 */
function flipLines(base: number[], indices: number[]): number[] {
  const out = [...base];
  for (const i of indices) out[i] = out[i] === 1 ? 0 : 1;
  return out;
}

function trigramOf(lines: number[], offset: number): TrigramName {
  const [a, b, c] = [lines[offset]!, lines[offset + 1]!, lines[offset + 2]!];
  const t = TRIGRAM_NAMES.find((n) => TRIGRAMS[n]![0] === a && TRIGRAMS[n]![1] === b && TRIGRAMS[n]![2] === c)!;
  return t;
}

/** 由六爻线（初→上，可为 0/1 或 6/7/8/9）构造完整卦信息（含宫/世应/纳甲/六亲） */
export function hexagramFromLines(linesIn: number[]): HexagramInfo {
  const lines = linesIn.map((v) => v % 2) as unknown as [number, number, number, number, number, number];
  const lower = trigramOf(lines, 0);
  const upper = trigramOf(lines, 3);
  // 找宫与世类：遍历八宫生成序列
  let found: { gong: TrigramName; shiClass: ShiClass; shiIndex: number; yingIndex: number } | null = null;
  for (const g of TRIGRAM_NAMES) {
    const base = [...TRIGRAMS[g]!, ...TRIGRAMS[g]!];
    const seq: Array<{ lines: number[]; cls: ShiClass }> = [
      { lines: base, cls: '八纯' },
      { lines: flipLines(base, [0]), cls: '一世' },
      { lines: flipLines(base, [0, 1]), cls: '二世' },
      { lines: flipLines(base, [0, 1, 2]), cls: '三世' },
      { lines: flipLines(base, [0, 1, 2, 3]), cls: '四世' },
      { lines: flipLines(base, [0, 1, 2, 3, 4]), cls: '五世' },
    ];
    const youhunLines = flipLines(seq[5]!.lines, [3]);
    seq.push({ lines: youhunLines, cls: '游魂' });
    const guihunLines = [...youhunLines];
    guihunLines[0] = base[0]!; guihunLines[1] = base[1]!; guihunLines[2] = base[2]!;
    seq.push({ lines: guihunLines, cls: '归魂' });
    for (const item of seq) {
      if (item.lines.join('') === lines.join('')) {
        const key = item.cls === '八纯' ? 'ben' : item.cls === '一世' ? 'shi1' : item.cls === '二世' ? 'shi2' : item.cls === '三世' ? 'shi3' : item.cls === '四世' ? 'shi4' : item.cls === '五世' ? 'shi5' : item.cls === '游魂' ? 'youhun' : 'guihun';
        const [shi, ying] = SHI_YING[key]!;
        found = { gong: g, shiClass: item.cls, shiIndex: shi, yingIndex: ying };
        break;
      }
    }
    if (found) break;
  }
  if (!found) throw new Error('找不到宫位（非法卦线）');

  const { gong, shiClass, shiIndex, yingIndex } = found;
  const najia = lines.map((_, i) => {
    const trig = i < 3 ? lower : upper;
    const stem = NAJIA_STEMS[trig]![i < 3 ? 'inner' : 'outer'];
    // NAJIA_BRANCHES[trig] 已编码「内卦三支 + 外卦三支」，直接按爻位取
    const branch = NAJIA_BRANCHES[trig]![i]!;
    return { stem, branch };
  });
  const liuqin = najia.map((n) => liuQin(gong, n.branch));
  return {
    lines,
    upper,
    lower,
    name: hexagramName(upper, lower),
    gong,
    gongWuxing: GONG_WUXING[gong],
    shiClass,
    shiIndex,
    yingIndex,
    najia,
    liuqin,
  };
}

/** 64 卦名表：upper*8 + lower（乾0 兑1 离2 震3 巽4 坎5 艮6 坤7） */
const NAMES: string[] = [];
function set(upper: TrigramName, lower: TrigramName, name: string) {
  NAMES[TRIGRAM_INDEX[upper]! * 8 + TRIGRAM_INDEX[lower]!] = name;
}
set('乾', '乾', '乾为天'); set('乾', '兑', '天泽履'); set('乾', '离', '天火同人'); set('乾', '震', '天雷无妄');
set('乾', '巽', '天风姤'); set('乾', '坎', '天水讼'); set('乾', '艮', '天山遁'); set('乾', '坤', '天地否');
set('兑', '乾', '泽天夬'); set('兑', '兑', '兑为泽'); set('兑', '离', '泽火革'); set('兑', '震', '泽雷随');
set('兑', '巽', '泽风大过'); set('兑', '坎', '泽水困'); set('兑', '艮', '泽山咸'); set('兑', '坤', '泽地萃');
set('离', '乾', '火天大有'); set('离', '兑', '火泽睽'); set('离', '离', '离为火'); set('离', '震', '火雷噬嗑');
set('离', '巽', '火风鼎'); set('离', '坎', '火水未济'); set('离', '艮', '火山旅'); set('离', '坤', '火地晋');
set('震', '乾', '雷天大壮'); set('震', '兑', '雷泽归妹'); set('震', '离', '雷火丰'); set('震', '震', '震为雷');
set('震', '巽', '雷风恒'); set('震', '坎', '雷水解'); set('震', '艮', '雷山小过'); set('震', '坤', '雷地豫');
set('巽', '乾', '风天小畜'); set('巽', '兑', '风泽中孚'); set('巽', '离', '风火家人'); set('巽', '震', '风雷益');
set('巽', '巽', '巽为风'); set('巽', '坎', '风水涣'); set('巽', '艮', '风山渐'); set('巽', '坤', '风地观');
set('坎', '乾', '水天需'); set('坎', '兑', '水泽节'); set('坎', '离', '水火既济'); set('坎', '震', '水雷屯');
set('坎', '巽', '水风井'); set('坎', '坎', '坎为水'); set('坎', '艮', '水山蹇'); set('坎', '坤', '水地比');
set('艮', '乾', '山天大畜'); set('艮', '兑', '山泽损'); set('艮', '离', '山火贲'); set('艮', '震', '山雷颐');
set('艮', '巽', '山风蛊'); set('艮', '坎', '山水蒙'); set('艮', '艮', '艮为山'); set('艮', '坤', '山地剥');
set('坤', '乾', '地天泰'); set('坤', '兑', '地泽临'); set('坤', '离', '地火明夷'); set('坤', '震', '地雷复');
set('坤', '巽', '地风升'); set('坤', '坎', '地水师'); set('坤', '艮', '地山谦'); set('坤', '坤', '坤为地');

export function hexagramName(upper: TrigramName, lower: TrigramName): string {
  return NAMES[TRIGRAM_INDEX[upper]! * 8 + TRIGRAM_INDEX[lower]!]!;
}

/** 由卦名反查（如「乾为天」） */
export function hexagramByName(name: string): HexagramInfo | null {
  for (let u = 0; u < 8; u++) {
    for (let l = 0; l < 8; l++) {
      if (NAMES[u * 8 + l] === name) {
        const lines = [...TRIGRAMS[TRIGRAM_NAMES[l]!]!, ...TRIGRAMS[TRIGRAM_NAMES[u]!]!];
        return hexagramFromLines(lines);
      }
    }
  }
  return null;
}

/** 旬空：给定日柱索引，返回两空亡地支 */
export function xunKongOf(dayIndex: number): [string, string] {
  const xunStart = Math.floor(((dayIndex % 60) + 60) % 60 / 10) * 10;
  const a = (xunStart + 10) % 12;
  const b = (xunStart + 11) % 12;
  const Z = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return [Z[a]!, Z[b]!];
}
