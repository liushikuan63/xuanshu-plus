/**
 * 安全拦截与免责注入（v5 §13.1 + D26）
 */

export const DISCLAIMER = '本软件提供中国传统术数排盘、古籍检索与文化研究辅助。排盘结果由既定规则计算；解释不构成医疗、投资、法律、人生或行为的确定性预测。请自行理性判断并咨询有资质的专业人士。';

export const SENSITIVE_RULES: Array<{ keyword: RegExp; guidance: string; category: string }> = [
  { keyword: /医|病|药|癌|孕|胎|生娃|手术/, guidance: '涉及健康与生育，仅提供趋势参考，不提供诊断；请咨询医生。', category: '健康/生育' },
  { keyword: /投资|股票|炒股|基金|币|理财/, guidance: '投资有风险，本软件不提供收益预测；请理性决策。', category: '投资' },
  { keyword: /官司|诉讼|报案|报警|刑/, guidance: '涉及法律事务，请咨询律师；卦象不作为法律证据。', category: '官非' },
  { keyword: /未成年|小孩|孩子/, guidance: '涉及未成年人，请寻求学校老师或专业机构帮助。', category: '未成年' },
];

export interface SafetyResult {
  blocked: boolean;
  categories: string[];
  disclaimer: string;
  guidance: string[];
}

export function safetyCheck(text: string): SafetyResult {
  const hits = SENSITIVE_RULES.filter((r) => r.keyword.test(text));
  return {
    blocked: hits.length > 0,
    categories: [...new Set(hits.map((h) => h.category))],
    disclaimer: DISCLAIMER,
    guidance: hits.map((h) => h.guidance),
  };
}

/** D26：反推类功能显式拦截 */
export function antiInferenceCheck(input: { text?: string; raw?: Record<string, unknown> }): string | null {
  const text = input.text ?? '';
  if (/反推|倒推|根据结果推|时辰不对.*(改|推)|推出生时间/.test(text)) {
    return '不支持由结果反推时辰/盘面等无依据推断；如时辰不明，建议改用六爻/梅花（不依赖出生时辰）。';
  }
  return null;
}
