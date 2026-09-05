/**
 * 八字「一生趋势」总览（问真八字式白话解读，D 级流派法）
 * 喜用神采用扶抑法简化：
 *   身强（dayMasterStrength=强）→ 喜 克泄耗（官杀/食伤/财），忌 印比；
 *   身弱 → 喜 生扶（印/比），忌 财官食伤。
 * 每步大运按干支十神相对日主的喜忌打分，给出「旺/平/弱」与一句白话说明。
 * 仅供自我参照，不构成确定性结论；KEY 解释以事后回标校准。
 */

import { GAN_WUXING, ZHI_WUXING, shiShenYinYang, type Gan, type Zhi } from '../../calendar/ganzhi.js';
import type { BaziChart } from './engine.js';

export type TrendLevel = '旺' | '平' | '弱';

export interface LifeTrend {
  startAge: number;
  startYear: number;
  ganZhi: string;
  nayin: string;
  trend: TrendLevel;
  /** 大运干支简评（天干十神为主、地支本气为辅） */
  note: string;
}

/** 十神 → 白话一句（喜忌标注） */
const SHI_SHEN_BAIHUA: Record<string, string> = {
  正官: '扛责任、守规矩的阶段，事业稳步推进，宜按部就班',
  七杀: '压力与竞争并存，敢闯敢拼收获也大，但身心要扛得住',
  正印: '学习充电、贵人扶持的好时候，适合考证进修、借力而上',
  偏印: '灵感足但易思虑过重，宜钻研专长，少钻牛角尖',
  食神: '才华外露、生活滋润，适合创作、技术变现',
  伤官: '想法多、爱挑战规则，表达和创造强，但易得罪人',
  正财: '求财务实、理财稳妥，适合经营与稳定进账',
  偏财: '财来财去、机会多，适合投资与人脉生意，但要防漏',
  比肩: '自立自强、朋友助力，宜竞争向上，防与人争利',
  劫财: '行动力强但易耗财，宜合伙谨慎，防破财',
};

function shiShenWx(dayMaster: Gan, gan: Gan): string {
  return shiShenYinYang(dayMaster, gan);
}

/** 身强 → 喜十神集合；身弱 → 喜印比 */
function xiJiOf(chart: BaziChart): { xi: Set<string>; ji: Set<string> } {
  const strong = chart.dayMasterStrength === '强';
  const xi = new Set(strong ? ['正官', '七杀', '食神', '伤官', '正财', '偏财'] : ['正印', '偏印', '比肩', '劫财']);
  const ji = new Set(strong ? ['正印', '偏印', '比肩', '劫财'] : ['正官', '七杀', '食神', '伤官', '正财', '偏财']);
  return { xi, ji };
}

function scoreOf(ss: string, xi: Set<string>, ji: Set<string>): number {
  if (xi.has(ss)) return 1;
  if (ji.has(ss)) return -1;
  return 0;
}

/** 大运干支喜忌打分 → 吉凶倾向 + 一句话白话 */
function trendOf(gan: Gan, zhi: Zhi, xi: Set<string>, ji: Set<string>): { trend: TrendLevel; note: string } {
  const ganS = shiShenWx(gan, gan);
  const zhiS = shiShenYinYang(gan, zhiStem(ZHI_WUXING[zhi]));
  const score = scoreOf(ganS, xi, ji) + scoreOf(zhiS, xi, ji);
  const note = SHI_SHEN_BAIHUA[ganS] ?? SHI_SHEN_BAIHUA[zhiS] ?? '平稳过渡，按部就班';
  const trend: TrendLevel = score > 0 ? '旺' : score < 0 ? '弱' : '平';
  return { trend, note };
}

const ZHI_TO_STEM: Record<string, Gan> = { 木: '甲', 火: '丙', 土: '戊', 金: '庚', 水: '壬' };

function zhiStem(wx: string): Gan {
  return ZHI_TO_STEM[wx] ?? '戊';
}

/** 一生趋势：8 步大运逐段白话 + 总评（年龄/年份取整显示） */
export function baziLifeTrends(chart: BaziChart): { trends: LifeTrend[]; summary: string } {
  const { xi, ji } = xiJiOf(chart);
  const trends: LifeTrend[] = chart.dayun.map((d) => {
    const { trend, note } = trendOf(d.ganZhi.gan as Gan, d.ganZhi.zhi as Zhi, xi, ji);
    return {
      startAge: Math.round(d.startAge),
      startYear: Math.round(d.startYear),
      ganZhi: d.ganZhi.gan + d.ganZhi.zhi,
      nayin: d.nayin,
      trend,
      note,
    };
  });
  // 总评（白话）
  const strongText = chart.dayMasterStrength === '强' ? '日主偏强，做事有自己的主见和冲劲' : chart.dayMasterStrength === '弱' ? '日主偏弱，更依赖机遇和身边人助力' : '日主中和，平衡稳健';
  const xiText = [...xi].slice(0, 2).join('、');
  const jiText = [...ji].slice(0, 2).join('、');
  const keyAges = trends.filter((t) => t.trend !== '平').map((t) => `${t.startAge}-${t.startAge + 9}岁`).join('、');
  const summary = `这一生${strongText}。走运时喜「${xiText}」助力、宜多发挥；忌讳「${jiText}」过旺、防其拖累。${keyAges ? `趋势明显的阶段在：${keyAges}。` : '整体走势平稳，按步就班即可。'}以上为流派简化解读，仅作自我参照，实际经历请逐步回标校准。`;
  return { trends, summary };
}

/** 当前流年一句话白话（供当年参考） */
export function baziCurrentYearNote(chart: BaziChart, year: number): string | null {
  const active = chart.dayun.find((d) => year >= d.startYear && year < d.startYear + 10) ?? chart.dayun[0];
  if (!active) return null;
  const { xi, ji } = xiJiOf(chart);
  const { trend, note } = trendOf(active.ganZhi.gan as Gan, active.ganZhi.zhi as Zhi, xi, ji);
  return `${year}年处「${active.ganZhi.gan}${active.ganZhi.zhi}」大运（${trend === '旺' ? '偏顺' : trend === '弱' ? '偏阻' : '平稳'}）：${note}。`;
}