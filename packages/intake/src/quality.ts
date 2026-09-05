/**
 * 问句质量提示与澄清追问（v5 §6.8）
 */

export interface QualityCheck {
  ok: boolean;
  warnings: string[];
  suggestions: string[];
}

export function checkQuality(text: string): QualityCheck {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (!text.trim()) {
    return { ok: false, warnings: ['问句为空'], suggestions: ['请描述你想问的具体事情。'] };
  }
  if (text.length < 4) {
    warnings.push('问句过短');
    suggestions.push('建议包含「谁、什么事、什么时间」。');
  }
  if (/算命|算一下|看看我|测一下/.test(text)) {
    warnings.push('存在过于笼统的开场');
    suggestions.push('直接说出具体问题，如「我的钱包在商场丢了，今天能找到吗」。');
  }
  if (/会不会成功|怎么样|好不好|行不行|能不能成/.test(text)) {
    warnings.push('问句过泛');
    suggestions.push('建议拆成「具体事项 + 时限」，例如「我投的 A 公司这个岗位，一个月内能否拿到 offer」。');
  }
  if (/前世|预知|保证|绝对|一定/.test(text)) {
    warnings.push('涉及不可验证或绝对化表述');
    suggestions.push('术数提供趋势与可能性，不提供精确回放或绝对承诺。');
  }
  return { ok: warnings.length === 0, warnings, suggestions };
}

/** 重复起卦提示（古籍「初筮告，再三渎」） */
export function repeatDivinationWarning(previousSummary: string, previousAt: string): string {
  return `同一事重复占会互相干扰（古籍云「初筮告，再三渎」）。你在 ${previousAt} 已占过「${previousSummary}」，建议先看上一条记录。`;
}

/** 证据不足提示 */
export function evidenceGapMessage(art: string): string {
  return `此流派（${art}）暂无内置依据，请导入书库，或参考「流派说法」区。`;
}
