/**
 * 六爻答复模板（v5 附录 C：六爻·求财节选为范式）
 */

import type { AnswerTemplate } from '@xuanshu/core';

export const LIUYAO_TEMPLATES: Record<string, AnswerTemplate> = {
  'liuyao.wealth.debt.v1': {
    templateId: 'liuyao.wealth.debt.v1',
    category: '求财.讨债',
    sections: [
      { id: 'conclusion', from: 'composer' },
      { id: 'yongshen', from: 'core.extractFacts', facts: ['财爻', '子孙', '兄弟', '月建', '日辰', '旬空', '月破'] },
      { id: 'signals', from: 'core.rules', rulePrefix: 'liuyao' },
      { id: 'timing', from: 'answer.timing', rulePrefix: 'liuyao.timing', fallback: '暂无内置应期推法' },
      { id: 'evidence', from: 'knowledge.retrieve', minHits: 1, fallback: '此流派暂无内置依据，请导入书库' },
      { id: 'disclaimer', from: 'answer.safety', always: true },
    ],
    forbidden: ['投资收益承诺', '具体金额保证', '法律催收建议'],
    recordHint: '记入案例本，并标注「是否收回/收回时间/金额比例」以便后续校准',
  },
  'liuyao.generic.v1': {
    templateId: 'liuyao.generic.v1',
    category: '其他',
    sections: [
      { id: 'conclusion', from: 'composer' },
      { id: 'signals', from: 'core.rules', rulePrefix: 'liuyao' },
      { id: 'timing', from: 'answer.timing', rulePrefix: 'liuyao.timing', fallback: '暂无内置应期推法' },
      { id: 'evidence', from: 'knowledge.retrieve', minHits: 1, fallback: '此流派暂无内置依据，请导入书库' },
      { id: 'disclaimer', from: 'answer.safety', always: true },
    ],
    forbidden: [],
    recordHint: '记录卦象与结果，事后回标应验情况',
  },
};

export function templateFor(templateId: string): AnswerTemplate | undefined {
  return LIUYAO_TEMPLATES[templateId];
}
