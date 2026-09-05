import { almanacOf } from '../calendar/almanac.js';
import { GAN_WUXING, WUXING_KE, WUXING_SHENG, type WuXing } from '../calendar/ganzhi.js';
import { buildBazi, type BaziConfig } from './bazi/engine.js';

export interface FortuneBirth {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: 'male' | 'female';
}

export interface FortuneMetric {
  id: 'relationship' | 'wealth' | 'career' | 'wellbeing';
  label: string;
  score: number;
  level: '较顺' | '平稳' | '留意';
  basis: string[];
  text: string;
}

export interface DailyFortune {
  date: string;
  birthPillars: string;
  birthConstellation: string;
  dayMaster: string;
  dayMasterElement: WuXing;
  dayPillar: string;
  dayElement: WuXing;
  relation: string;
  favorableElements: WuXing[];
  luckyColors: string[];
  luckyNumbers: number[];
  favorableDirections: string[];
  metrics: FortuneMetric[];
  tips: string[];
  cautions: string[];
  summary: string;
  disclaimer: string;
}

const ELEMENT_PROFILE: Record<WuXing, { colors: string[]; numbers: number[]; directions: string[] }> = {
  木: { colors: ['青绿', '墨绿'], numbers: [3, 8], directions: ['东', '东南'] },
  火: { colors: ['朱红', '紫'], numbers: [2, 7], directions: ['南'] },
  土: { colors: ['黄', '米白'], numbers: [5, 0], directions: ['东北', '西南'] },
  金: { colors: ['白', '银灰'], numbers: [4, 9], directions: ['西', '西北'] },
  水: { colors: ['黑', '深蓝'], numbers: [1, 6], directions: ['北'] },
};

const REVERSE_SHENG = Object.fromEntries(
  Object.entries(WUXING_SHENG).map(([from, to]) => [to, from]),
) as Record<WuXing, WuXing>;

function dayRelation(master: WuXing, current: WuXing): { id: string; text: string; modifier: number } {
  if (master === current) return { id: 'same', text: `当日${current}与日主${master}比和`, modifier: 3 };
  if (WUXING_SHENG[current] === master) return { id: 'support', text: `当日${current}生扶日主${master}`, modifier: 8 };
  if (WUXING_SHENG[master] === current) return { id: 'output', text: `日主${master}生当日${current}`, modifier: -1 };
  if (WUXING_KE[current] === master) return { id: 'pressure', text: `当日${current}克日主${master}`, modifier: -6 };
  return { id: 'resource', text: `日主${master}克当日${current}`, modifier: 1 };
}

function favorableElements(master: WuXing, strength: '强' | '中' | '弱'): WuXing[] {
  if (strength === '强') return [WUXING_SHENG[master], WUXING_KE[master]];
  if (strength === '弱') return [master, REVERSE_SHENG[master]];
  return [master, WUXING_SHENG[master]];
}

function includesAny(items: string[], words: string[]): boolean {
  return items.some((item) => words.some((word) => item.includes(word)));
}

function metric(
  id: FortuneMetric['id'],
  label: string,
  base: number,
  basis: string[],
  text: string,
): FortuneMetric {
  const score = Math.max(20, Math.min(90, Math.round(base)));
  return { id, label, score, level: score >= 70 ? '较顺' : score >= 45 ? '平稳' : '留意', basis, text };
}

/** 以八字日主与指定日期黄历生成透明、可复现的文化参考。 */
export async function fortuneOf(
  birth: FortuneBirth,
  year: number,
  month: number,
  day: number,
  config?: BaziConfig,
): Promise<DailyFortune> {
  const almanac = almanacOf(year, month, day);
  const birthAlmanac = almanacOf(birth.year, birth.month, birth.day);
  const chart = await buildBazi(birth, config);
  const dayMasterElement = GAN_WUXING[chart.dayMaster];
  const dayGan = almanac.dayGanzhi[0];
  if (!dayGan || !(dayGan in GAN_WUXING)) throw new Error(`无法识别当日天干：${almanac.dayGanzhi}`);
  const dayElement = GAN_WUXING[dayGan as keyof typeof GAN_WUXING];
  const relation = dayRelation(dayMasterElement, dayElement);
  const favorable = favorableElements(dayMasterElement, chart.dayMasterStrength);
  const profiles = favorable.map((element) => ELEMENT_PROFILE[element]);
  const luckyColors = [...new Set(profiles.flatMap((profile) => profile.colors))];
  const luckyNumbers = [...new Set(profiles.flatMap((profile) => profile.numbers))];
  const favorableDirections = [...new Set(profiles.flatMap((profile) => profile.directions))];

  const goodRelationship = includesAny(almanac.yi, ['嫁娶', '会亲友', '纳采']);
  const badRelationship = includesAny(almanac.ji, ['嫁娶', '纳采']);
  const goodWealth = includesAny(almanac.yi, ['交易', '纳财', '开市', '立券']);
  const badWealth = includesAny(almanac.ji, ['交易', '纳财', '开市', '立券']);
  const goodCareer = includesAny(almanac.yi, ['开市', '赴任', '出行', '动土']);
  const badCareer = includesAny(almanac.ji, ['开市', '赴任', '出行', '动土']);
  const difficultDay = ['破', '危', '闭'].includes(almanac.jianChu);

  const metrics: FortuneMetric[] = [
    metric(
      'relationship', '关系', 60 + relation.modifier + (goodRelationship ? 8 : 0) - (badRelationship ? 8 : 0),
      [relation.text, `黄历宜：${almanac.yi.slice(0, 4).join('、') || '无特别项目'}`],
      goodRelationship ? '适合安排沟通与相聚，重要关系仍以真实互动为准。' : '保持耐心沟通，不凭单日指标替代双方判断。',
    ),
    metric(
      'wealth', '财务', 58 + relation.modifier + (goodWealth ? 8 : 0) - (badWealth ? 8 : 0),
      [relation.text, `建除：${almanac.jianChu || '未标注'}`],
      goodWealth ? '传统宜项包含交易或纳财，可用于安排常规事务。' : '以预算和风险核验为先，不据此进行投资决策。',
    ),
    metric(
      'career', '事业', 60 + relation.modifier + (goodCareer ? 8 : 0) - (badCareer ? 8 : 0),
      [relation.text, `黄历忌：${almanac.ji.slice(0, 4).join('、') || '无特别项目'}`],
      goodCareer ? '适合推进已有计划并核对关键节点。' : '宜把任务拆小、复核资料，再决定是否启动重要事项。',
    ),
    metric(
      'wellbeing', '状态', 62 + (relation.id === 'support' ? 6 : 0) - (difficultDay ? 8 : 0),
      [`建除：${almanac.jianChu || '未标注'}`, `凶煞：${almanac.unluckyGods.slice(0, 3).join('、') || '无特别标注'}`],
      difficultDay ? '适合降低节奏、保证休息；身体不适应咨询专业人员。' : '维持规律作息和适度活动，不把民俗提示当作健康诊断。',
    ),
  ];

  const tips = [
    relation.text,
    `可参考${favorable.join('、')}对应的色彩与方向安排非关键日常事项`,
    almanac.solarTerm ? `今日节气：${almanac.solarTerm}` : `${almanac.week}，农历${almanac.lunarDate}`,
  ];
  const cautions = [
    almanac.ji.length ? `传统忌项：${almanac.ji.slice(0, 5).join('、')}` : '',
    almanac.clash ? `冲：${almanac.clash}${almanac.sha ? `，煞${almanac.sha}` : ''}` : '',
    almanac.pengZu.length ? `彭祖百忌：${almanac.pengZu.join('；')}` : '',
  ].filter(Boolean);
  const average = Math.round(metrics.reduce((sum, item) => sum + item.score, 0) / metrics.length);

  return {
    date: almanac.date,
    birthPillars: [chart.year, chart.month, chart.day, chart.hour].map((pillar) => `${pillar.gan}${pillar.zhi}`).join(' '),
    birthConstellation: birthAlmanac.constellation,
    dayMaster: chart.dayMaster,
    dayMasterElement,
    dayPillar: almanac.dayGanzhi,
    dayElement,
    relation: relation.text,
    favorableElements: favorable,
    luckyColors,
    luckyNumbers,
    favorableDirections,
    metrics,
    tips,
    cautions,
    summary: `${almanac.date} 综合文化参考 ${average} 分；${relation.text}。各项分数由公开规则计算，不代表现实结果。`,
    disclaimer: '每日运势属于传统文化参考，不构成医疗、投资、法律、关系或职业建议，也不应替代现实证据。',
  };
}
