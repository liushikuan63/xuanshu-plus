/**
 * OpenAI 兼容客户端：调用 /chat/completions，解析结构化输出。
 * 失败策略（v5 §10.3）：JSON 解析失败 → 正则修复一次 → 仍失败则降级为原文摘录，不渲染不可信 JSON。
 */

import { chatEndpoint, providerById, type AIConnectionConfig } from './providerRegistry.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  responseJson?: boolean;
  signal?: AbortSignal;
}

export async function chatCompletions(cfg: AIConnectionConfig, messages: ChatMessage[], opts: ChatOptions = {}, fetchImpl: typeof fetch = fetch): Promise<string> {
  const p = providerById(cfg.providerId);
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? cfg.temperature ?? 0.2,
    stream: false,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.responseJson) {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetchImpl(chatEndpoint(cfg), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${p.authPrefix} ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal ?? AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`AI 请求失败 HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 响应缺少 choices[0].message.content');
  return content;
}

export interface JudgmentCard {
  claimId: string;
  type: string;
  text: string;
  evidenceIds: string[];
  confidence: number;
  counterEvidence?: string;
  timingCandidates?: string[];
  confidenceLevel: 'E';
  citationVerified: boolean;
  needsHumanReview: boolean;
}

export interface JudgmentResult {
  cards: JudgmentCard[];
  unsupportedClaims: string[];
  coverageScore: number;
  /** 降级标记：true 表示未能按契约解析，仅原文摘录 */
  degraded: boolean;
  rawText: string;
}

/** 解析判断卡 JSON；失败时正则提取一次；仍失败 → 降级为原文摘录 */
export function parseJudgmentResult(text: string): JudgmentResult {
  const tryJson = (t: string): JudgmentResult | null => {
    try {
      const data = JSON.parse(t) as Record<string, unknown>;
      if (!Array.isArray(data.cards)) return null;
      const cards: JudgmentCard[] = [];
      for (const value of data.cards) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const card = value as Record<string, unknown>;
        if (
          typeof card.claimId !== 'string'
          || typeof card.type !== 'string'
          || typeof card.text !== 'string'
          || !Array.isArray(card.evidenceIds)
          || !card.evidenceIds.every((id) => typeof id === 'string')
          || typeof card.confidence !== 'number'
          || !Number.isFinite(card.confidence)
        ) continue;
        cards.push({
          claimId: card.claimId,
          type: card.type,
          text: card.text,
          evidenceIds: card.evidenceIds,
          confidence: Math.max(0, Math.min(1, card.confidence)),
          ...(typeof card.counterEvidence === 'string' ? { counterEvidence: card.counterEvidence } : {}),
          ...(Array.isArray(card.timingCandidates) && card.timingCandidates.every((item) => typeof item === 'string')
            ? { timingCandidates: card.timingCandidates }
            : {}),
          confidenceLevel: 'E',
          citationVerified: false,
          needsHumanReview: true,
        });
      }
      const invalidCards = data.cards.length - cards.length;
      const unsupportedClaims = Array.isArray(data.unsupportedClaims)
        ? data.unsupportedClaims.filter((item): item is string => typeof item === 'string')
        : [];
      if (invalidCards > 0) unsupportedClaims.push(`AI 响应中有 ${invalidCards} 张判断卡结构无效，已忽略`);
      const coverage = typeof data.coverageScore === 'number' && Number.isFinite(data.coverageScore) ? data.coverageScore : 0;
      return {
        cards,
        unsupportedClaims,
        coverageScore: Math.max(0, Math.min(1, coverage)),
        degraded: invalidCards > 0,
        rawText: t,
      };
    } catch {
      return null;
    }
  };

  const direct = tryJson(text.trim());
  if (direct) return direct;

  // 尝试提取 ```json ... ``` 代码块
  const fence = /```(?:json)?\s*([\s\S]*?)```/g.exec(text);
  if (fence && fence[1]) {
    const fromFence = tryJson(fence[1].trim());
    if (fromFence) return fromFence;
  }
  // 尝试提取第一个 { ... } JSON 对象
  const brace = text.indexOf('{');
  if (brace >= 0) {
    const fromBrace = tryJson(text.slice(brace));
    if (fromBrace) return fromBrace;
  }
  return { cards: [], unsupportedClaims: [text.slice(0, 200)], coverageScore: 0, degraded: true, rawText: text };
}
