/**
 * 事项分类词典 QuestionTaxonomy（v5 附录 B + §0.4）
 */

import type { ArtType, CategoryId, KeyFactor, SubCategoryId } from '@xuanshu/core';

export interface CategoryDef {
  id: CategoryId;
  subCategories: SubCategoryId[];
  recommendedArts: ArtType[];
  keyFactors: KeyFactor[];
  guidance: string;
  forbidden: string[];
}

export const TAXONOMY: Record<CategoryId, CategoryDef> = {
  求财: {
    id: '求财',
    subCategories: ['正财', '偏财', '生意', '讨债', '投资', '合伙分成'],
    recommendedArts: ['liuyao', 'bazi', 'meihua'],
    keyFactors: [
      { name: '财路', label: '求财途径', type: 'text', required: true, hint: '如：工资、生意、投资、讨债' },
      { name: '时限', label: '期望时限', type: 'text', required: false, hint: '如：三个月内' },
      { name: 'needTiming', label: '是否需要应期', type: 'enum', options: ['是', '否'], required: false, hint: '' },
    ],
    guidance: '求财问事建议明确「财从何来、要多少、多久内」，泛问「财运如何」难以取用神。',
    forbidden: ['承诺收益', '保证金额', '投资建议'],
  },
  事业: {
    id: '事业',
    subCategories: ['求职', '升迁', '创业', '考公', '项目成败', '职场人际'],
    recommendedArts: ['liuyao', 'bazi', 'ziwei', 'qimen'],
    keyFactors: [
      { name: '事项', label: '具体事项', type: 'text', required: true, hint: '如：投了 A 公司某岗位' },
      { name: '目标', label: '目标', type: 'text', required: true, hint: '如：一个月内拿到 offer' },
      { name: '时限', label: '时限', type: 'text', required: false, hint: '' },
    ],
    guidance: '事业问事建议拆成「某岗位/某项目 + 时限 + 目标」，泛问「事业成不成功」无法断应期。',
    forbidden: ['承诺录用/中标', '建议行贿等违规操作'],
  },
  感情: {
    id: '感情',
    subCategories: ['姻缘', '婚姻', '分手', '复合', '桃花', '异地'],
    recommendedArts: ['liuyao', 'bazi', 'ziwei', 'meihua'],
    keyFactors: [
      { name: '现状', label: '关系现状', type: 'enum', options: ['已婚', '恋爱', '分手', '相亲', '暗恋'], required: true, hint: '关系现状决定取用神' },
      { name: '诉求', label: '诉求', type: 'enum', options: ['复合', '推进', '分手', '求证'], required: true, hint: '' },
      { name: '时限', label: '时限', type: 'text', required: false, hint: '' },
    ],
    guidance: '感情问事避免「他爱不爱我」这类主观不可证伪问法；建议「我和某人三个月内能否确定关系」。',
    forbidden: ['预测具体第三人身份', '给出分手/结婚指令', '窥探他人隐私'],
  },
  学业: {
    id: '学业',
    subCategories: ['考试', '升学', '考证', '名次'],
    recommendedArts: ['liuyao', 'meihua', 'bazi'],
    keyFactors: [
      { name: '考试', label: '哪场考试', type: 'text', required: true, hint: '' },
      { name: '时限', label: '考试时间', type: 'text', required: true, hint: '' },
    ],
    guidance: '学业问事建议具体到「哪场考试、什么时候」，泛问「学习运」无应期。',
    forbidden: ['承诺名次/录取'],
  },
  健康: {
    id: '健康',
    subCategories: ['疾病趋势', '康复', '体检'],
    recommendedArts: ['bazi', 'liuyao'],
    keyFactors: [
      { name: '问题', label: '关注方面', type: 'text', required: true, hint: '仅看趋势，不给诊断' },
    ],
    guidance: '健康问题仅看趋势与时机，不提供诊断；请遵医嘱。',
    forbidden: ['诊断疾病', '用药建议', '替代医疗'],
  },
  出行: {
    id: '出行',
    subCategories: ['迁旅', '择日', '安全', '移居'],
    recommendedArts: ['liuyao', 'meihua', 'qimen'],
    keyFactors: [
      { name: '目的地', label: '目的地', type: 'text', required: true, hint: '' },
      { name: '时间', label: '出行时间', type: 'text', required: true, hint: '' },
    ],
    guidance: '出行问事建议给出目的地与时间，可断顺利与否、方位吉凶。',
    forbidden: ['替代安全决策'],
  },
  官非: {
    id: '官非',
    subCategories: ['诉讼', '纠纷', '口舌', '违章'],
    recommendedArts: ['liuyao', 'liuren'],
    keyFactors: [
      { name: '性质', label: '纠纷性质', type: 'text', required: true, hint: '诉讼/仲裁/调解等' },
    ],
    guidance: '官非问题建议咨询律师；卦象仅供心态参考。',
    forbidden: ['法律结论', '诉讼必胜承诺'],
  },
  失物: {
    id: '失物',
    subCategories: ['财物', '证件', '宠物', '人'],
    recommendedArts: ['liuyao', 'xiaoliuren', 'meihua', 'qimen'],
    keyFactors: [
      { name: 'what', label: '丢失何物', type: 'text', required: true, hint: '证件取父母爻、钱包取妻财爻，差别很大' },
      { name: 'lostAt', label: '何时何地丢失', type: 'text', required: true, hint: '' },
      { name: 'isStolen', label: '是否怀疑被盗', type: 'enum', options: ['是', '否', '不确定'], required: true, hint: '决定要不要参看官鬼爻辨盗' },
      { name: 'needTiming', label: '是否需要应期', type: 'enum', options: ['是', '否'], required: false, hint: '' },
    ],
    guidance: '失物问事必填「何物 + 何时何地 + 是否疑盗」；贵重物品被盗应提示报警。',
    forbidden: ['指名道姓断言某人盗窃', '教唆搜查他人'],
  },
  择日: {
    id: '择日',
    subCategories: ['婚嫁', '开业', '动土', '搬家', '签约'],
    recommendedArts: ['qimen', 'liuyao'],
    keyFactors: [
      { name: '事由', label: '择日事由', type: 'text', required: true, hint: '' },
      { name: '范围', label: '可选时间范围', type: 'text', required: true, hint: '如：下个月内' },
    ],
    guidance: '择日需提供事由与可选时间范围。',
    forbidden: ['替代黄历/专业择日'],
  },
  家宅: {
    id: '家宅',
    subCategories: ['买房', '租房', '风水', '装修', '迁坟'],
    recommendedArts: ['liuyao', 'qimen'],
    keyFactors: [
      { name: '事项', label: '家宅事项', type: 'text', required: true, hint: '' },
    ],
    guidance: '家宅问事建议具体到「买房/租房/装修某处」，迁坟不给确定结论。',
    forbidden: ['风水断吉凶绝对化'],
  },
  生育: {
    id: '生育',
    subCategories: ['怀孕', '生产'],
    recommendedArts: ['liuyao', 'bazi'],
    keyFactors: [
      { name: '事项', label: '关注方面', type: 'text', required: true, hint: '仅看趋势' },
    ],
    guidance: '生育问题仅看时机与趋势，不提供医疗结论；请咨询产科医生。',
    forbidden: ['医疗结论', '性别预测'],
  },
  合作: {
    id: '合作',
    subCategories: ['合伙', '签约', '谈判', '借贷'],
    recommendedArts: ['liuyao', 'liuren', 'ziwei'],
    keyFactors: [
      { name: '对象', label: '合作对象', type: 'text', required: true, hint: '' },
      { name: '事项', label: '合作内容', type: 'text', required: true, hint: '' },
    ],
    guidance: '合作问事建议说明合作内容与关键分歧。',
    forbidden: ['替代尽职调查'],
  },
  决策: {
    id: '决策',
    subCategories: ['A/B选择', '去留', '时机'],
    recommendedArts: ['meihua', 'liuyao', 'ziwei'],
    keyFactors: [
      { name: 'options', label: '备选项', type: 'text', required: true, hint: '如：A 还是 B' },
    ],
    guidance: '决策问事建议明确列出备选项与决策时限。',
    forbidden: ['替代理性决策'],
  },
  其他: {
    id: '其他',
    subCategories: ['综合', '自定义'],
    recommendedArts: ['liuyao', 'meihua'],
    keyFactors: [],
    guidance: '其他事项请尽量描述清楚背景、时间与诉求。',
    forbidden: [],
  },
};

export function categories(): CategoryId[] {
  return Object.keys(TAXONOMY) as CategoryId[];
}

export function categoryDef(cat: CategoryId): CategoryDef {
  return TAXONOMY[cat];
}

/** 敏感事项拦截（intake 阶段） */
export function sensitiveCategories(): CategoryId[] {
  return ['健康', '生育', '官非'];
}
