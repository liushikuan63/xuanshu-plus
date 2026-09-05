import {
  GAN_WUXING,
  WUXING_KE,
  WUXING_SHENG,
  ZHI_WUXING,
  type WuXing,
} from '../../calendar/ganzhi.js';
import { computeBoneWeight, type BoneWeightResult } from '../boneweight.js';
import { baziLifeTrends, type LifeTrend } from '../bazi/lifetrend.js';
import { shiShenToDayMaster, type BaziChart, type Pillar } from '../bazi/engine.js';

export type JingPiEvidenceLevel = 'C' | 'D';

export interface BaziJingPiSection {
  id: 'pillars' | 'elements' | 'tenGods' | 'markers' | 'periods' | 'boneWeight';
  title: string;
  summary: string;
  facts: string[];
  basis: string[];
  evidenceLevel: JingPiEvidenceLevel;
}

export interface BaziJingPiResult {
  headline: string;
  pillars: string;
  elementCounts: Record<WuXing, number>;
  favorableElements: WuXing[];
  stemRoles: Array<{ pillar: string; stem: string; role: string }>;
  activePeriod: LifeTrend | null;
  boneWeight: BoneWeightResult;
  sections: BaziJingPiSection[];
  reviewTips: string[];
  disclaimer: string;
}

const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱'] as const;

function pillarText(pillar: Pillar): string {
  return `${pillar.gan}${pillar.zhi}`;
}

function favorableElements(chart: BaziChart): WuXing[] {
  const master = GAN_WUXING[chart.dayMaster];
  const resource = (Object.keys(WUXING_SHENG) as WuXing[]).find((element) => WUXING_SHENG[element] === master)!;
  if (chart.dayMasterStrength === '强') return [WUXING_SHENG[master], WUXING_KE[master]];
  if (chart.dayMasterStrength === '弱') return [master, resource];
  return [master, WUXING_SHENG[master]];
}

function elementCounts(chart: BaziChart): Record<WuXing, number> {
  const counts: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of [chart.year, chart.month, chart.day, chart.hour]) {
    counts[GAN_WUXING[pillar.gan]] += 1;
    counts[ZHI_WUXING[pillar.zhi]] += 1;
  }
  return counts;
}

function formatCounts(counts: Record<WuXing, number>): string {
  return (Object.entries(counts) as Array<[WuXing, number]>).map(([element, count]) => `${element}${count}`).join('、');
}

function activePeriodOf(chart: BaziChart, referenceYear: number): LifeTrend | null {
  const trends = baziLifeTrends(chart).trends;
  return trends.find((period) => referenceYear >= period.startYear && referenceYear < period.startYear + 10) ?? null;
}

/** 将当前八字盘拆为可复核的分层解读，不输出人生事件的确定性预测。 */
export function baziJingPi(chart: BaziChart, referenceYear = new Date().getFullYear()): BaziJingPiResult {
  if (!Number.isInteger(referenceYear) || referenceYear < 1900 || referenceYear > 2200) {
    throw new RangeError(`无效参考年份：${referenceYear}`);
  }

  const pillarList = [chart.year, chart.month, chart.day, chart.hour];
  const pillars = pillarList.map(pillarText).join(' ');
  const masterElement = GAN_WUXING[chart.dayMaster];
  const counts = elementCounts(chart);
  const favorable = favorableElements(chart);
  const stemRoles = pillarList.map((pillar, index) => ({
    pillar: PILLAR_NAMES[index]!,
    stem: pillar.gan,
    role: shiShenToDayMaster(chart.dayMaster, pillar.gan),
  }));
  const hiddenRoles = pillarList.flatMap((pillar, index) => pillar.cangGan.map((stem) =>
    `${PILLAR_NAMES[index]}藏${stem}（${shiShenToDayMaster(chart.dayMaster, stem)}）`,
  ));
  const markers = Object.entries(chart.shensha).flatMap(([name, branches]) =>
    branches.map((branch) => `${name}见${branch}`),
  );
  const activePeriod = activePeriodOf(chart, referenceYear);
  const trend = baziLifeTrends(chart);
  const boneWeight = computeBoneWeight(
    chart.normalized.year,
    chart.normalized.month,
    chart.normalized.day,
    chart.normalized.hour,
    chart.normalized.minute,
  );
  const strongest = (Object.entries(counts) as Array<[WuXing, number]>).sort((a, b) => b[1] - a[1])[0]!;
  const periodFact = activePeriod
    ? `${referenceYear} 年位于约 ${activePeriod.startAge}-${activePeriod.startAge + 9} 岁的${activePeriod.ganZhi}大运，简化趋势标记为“${activePeriod.trend}”`
    : `${referenceYear} 年不在当前八步大运的计算范围内`;

  const sections: BaziJingPiSection[] = [
    {
      id: 'pillars',
      title: '四柱与日主',
      summary: `四柱为 ${pillars}，以日干${chart.dayMaster}为日主，五行属${masterElement}；当前简化旺衰判为“${chart.dayMasterStrength}”。`,
      facts: [
        `起运方向：${chart.qiyun.direction}，约 ${chart.qiyun.age.toFixed(2)} 岁起运`,
        `排盘口径：${chart.config.yearSwitch === 'lichun' ? '立春换年' : '正月初一换年'}、${chart.config.monthSwitch === 'jieqi' ? '节气换月' : '初一换月'}、子初 ${chart.config.zishiSplit}`,
      ],
      basis: ['日主取日柱天干', '旺衰来自当前引擎的月令生扶简化规则', `configHash ${chart.configHash.slice(0, 12)}`],
      evidenceLevel: 'C',
    },
    {
      id: 'elements',
      title: '五行基础分布',
      summary: `按四柱天干与地支本气各计一次：${formatCounts(counts)}；数量最多的是${strongest[0]}（${strongest[1]}项）。`,
      facts: [`扶抑法简化参考五行：${favorable.join('、')}`, '基础计数未把藏干权重、月令旺衰或调候折算为概率'],
      basis: pillarList.map((pillar, index) => `${PILLAR_NAMES[index]}：${pillar.gan}属${GAN_WUXING[pillar.gan]}，${pillar.zhi}属${ZHI_WUXING[pillar.zhi]}`),
      evidenceLevel: 'D',
    },
    {
      id: 'tenGods',
      title: '十神结构',
      summary: `透干映射为：${stemRoles.map((item) => `${item.pillar}${item.stem}·${item.role}`).join('；')}。`,
      facts: hiddenRoles,
      basis: ['十神均以日主阴阳与五行生克映射', '透干和藏干分开陈列，不把出现次数直接等同于现实事件'],
      evidenceLevel: 'C',
    },
    {
      id: 'markers',
      title: '神煞记录',
      summary: markers.length ? `当前规则检出：${markers.join('、')}。` : '当前规则未检出已实现的常用神煞。',
      facts: ['神煞只作辅助标签，不能脱离四柱结构单独判定结果'],
      basis: ['当前引擎实现桃花、驿马、文昌、羊刃、禄神、将星、华盖与天乙贵人'],
      evidenceLevel: 'D',
    },
    {
      id: 'periods',
      title: '大运阶段',
      summary: periodFact,
      facts: [activePeriod?.note ?? '可在一生趋势表中逐段查看八步大运', trend.summary],
      basis: ['大运顺逆由出生年干阴阳与性别决定', '起运按相邻节令距离并以三天折一年', '趋势仅以运干支十神喜忌作简化标记'],
      evidenceLevel: 'D',
    },
    {
      id: 'boneWeight',
      title: '称骨民俗参考',
      summary: `${boneWeight.yearGanzhi}年、农历${boneWeight.lunarDate}、${boneWeight.hourBranch}时，四项合计 ${boneWeight.label}。`,
      facts: [boneWeight.poem, boneWeight.plain],
      basis: boneWeight.parts.map((part) => `${part.name}：${part.label}`),
      evidenceLevel: 'D',
    },
  ];

  return {
    headline: `八字分层解读 · ${chart.dayMaster}${masterElement}日主 · ${chart.dayMasterStrength}`,
    pillars,
    elementCounts: counts,
    favorableElements: favorable,
    stemRoles,
    activePeriod,
    boneWeight,
    sections,
    reviewTips: [
      '先核对出生时间、时区和换日口径，再讨论解释。',
      '把大运阶段与已发生事件逐条对照，记录不符合之处。',
      '五行数量与趋势标签是规则分类，不是概率或现实结果保证。',
    ],
    disclaimer: '本解读用于中国传统命理规则的学习与复核，不构成医疗、投资、法律、关系、职业或人生决策建议。',
  };
}
