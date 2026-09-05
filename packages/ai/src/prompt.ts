/**
 * 提示工程（v5 §10.2）：禁止算盘 + 事项约束 + 引用纪律 + 输出契约
 */

import { artLabel } from '@xuanshu/core';

export const SYSTEM_PROMPT = `你是玄枢引用助理。只根据提供的结构化盘面 JSON、事项上下文和检索片段输出；绝不自行推算四柱、干支、节气、世应、纳甲、三传、互变。若盘面 JSON 与引用冲突，以盘面 JSON 为准并在「证据不足」中说明。每条判断卡必须列出支持证据与反驳证据；无检索依据的论断写入 unsupportedClaims。答复必须遵循事项模板（结论→依据→关键信号→应期→反证→建议），不得跳步、不得泛化、不得给出医疗/投资/法律的确定性结论。

引用纪律：你只能引用已提供的检索片段，并逐字复制其 quote 字段，附上 canonicalId 与 segId。不得凭记忆写出任何古籍原文。若片段不足以支撑论断，在 unsupportedClaims 中说明并留空 evidenceIds——这优于编造一条看似合理的引文。`;

export const JUDGMENT_CARD_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claimId: { type: 'string' },
          type: { type: 'string', enum: ['格局', '旺衰', '用神', '卦象', '应期', '风险提示'] },
          text: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          counterEvidence: { type: 'string' },
          timingCandidates: { type: 'array', items: { type: 'string' } },
          confidenceLevel: { type: 'string', enum: ['E'] },
          citationVerified: { type: 'boolean' },
          needsHumanReview: { type: 'boolean' },
        },
        required: ['claimId', 'type', 'text', 'evidenceIds', 'confidence'],
      },
    },
    unsupportedClaims: { type: 'array', items: { type: 'string' } },
    coverageScore: { type: 'number' },
  },
  required: ['cards', 'unsupportedClaims'],
};

export interface PromptContext {
  art: string;
  chartJson: Record<string, unknown>;
  configHash: string;
  question?: string;
  category?: string;
  summary?: string;
  ruleHits: Array<{ ruleId: string; text: string }>;
  evidence: Array<{ quote: string; canonicalId: string; segId: string }>;
  anonymize?: boolean;
}

export function buildUserPrompt(ctx: PromptContext): string {
  const parts: string[] = [];
  parts.push(`事项：${ctx.category ?? '其他'}${ctx.summary ? `（${ctx.summary}）` : ''}`);
  if (ctx.question) parts.push(`用户问句：${ctx.question}`);
  parts.push(`盘面 JSON（${artLabel(ctx.art)}）：\n${JSON.stringify(ctx.chartJson)}`);
  parts.push(`configHash：${ctx.configHash}`);
  if (ctx.ruleHits.length > 0) {
    parts.push(`已命中的计算规则：\n${ctx.ruleHits.map((r) => `- ${r.ruleId}: ${r.text}`).join('\n')}`);
  } else {
    parts.push('已命中的计算规则：无');
  }
  if (ctx.evidence.length > 0) {
    parts.push(`检索片段（引用纪律：逐字引用）：\n${ctx.evidence.map((e) => `- [${e.canonicalId} ${e.segId}] ${e.quote}`).join('\n')}`);
  } else {
    parts.push('检索片段：无（证据缺口，请在 unsupportedClaims 中说明）');
  }
  parts.push(`输出契约（必须返回合法 JSON，schema 如下）：\n${JSON.stringify(JUDGMENT_CARD_SCHEMA)}`);
  if (ctx.anonymize) parts.push('匿名化：已开启，请勿推断任何可识别身份的信息。');
  return parts.join('\n\n');
}

export function buildMessages(ctx: PromptContext): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(ctx) },
  ];
}
