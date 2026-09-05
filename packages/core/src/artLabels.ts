/**
 * 术数中文名映射：仅用于「用户可见显示」，不改变内部标识符。
 * 覆盖 playbook 中出现的全部术数 id（含奇门/六壬等未实现的备选）。
 */

export const ART_LABELS: Record<string, string> = {
  liuyao: '六爻',
  meihua: '梅花易数',
  xiaoliuren: '小六壬',
  bazi: '八字',
  ziwei: '紫微斗数',
  qimen: '奇门遁甲',
  liuren: '大六壬',
  jinkou: '金口诀',
};

/** id → 中文显示名；未知 id 原样回退 */
export function artLabel(id: string): string {
  return ART_LABELS[id] ?? id;
}
