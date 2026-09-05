/**
 * AnswerComposer：模板 + 计算层事实 + 知识层原文 + 受约束 AI 四层装配（v5 §0.4）
 * 不靠模型自由发挥；无证据即报缺口。
 */

import type { AnswerTemplate, CitationRef, FactBundle, RuleHit, TimingCandidate } from '@xuanshu/core';
import { safetyCheck, DISCLAIMER } from './safety.js';

export interface EvidenceHit {
  segment: string;
  citation: CitationRef;
  score: number;
}

export interface ComposerInput {
  template: AnswerTemplate;
  facts: FactBundle[];
  ruleHits: RuleHit[];
  timingCandidates: TimingCandidate[];
  evidence: EvidenceHit[];
  questionText?: string;
  aiCard?: { text: string; claims: Array<{ text: string; evidenceIds: string[]; confidence: number }>; needsHumanReview: boolean };
}

export interface AnswerSection {
  id: string;
  title: string;
  content: string;
  citations: CitationRef[];
  from: ComposerInput['template']['sections'][number]['from'];
}

export interface ComposedAnswer {
  sections: AnswerSection[];
  gaps: string[];
  disclaimer: string;
}

export function composeAnswer(input: ComposerInput): ComposedAnswer {
  const sections: AnswerSection[] = [];
  const gaps: string[] = [];

  for (const sec of input.template.sections) {
    if (sec.always && sec.id === 'disclaimer') {
      sections.push({ id: sec.id, title: '免责声明', content: DISCLAIMER, citations: [], from: sec.from });
      continue;
    }
    switch (sec.from) {
      case 'core.extractFacts': {
        const factIds = sec.facts ?? [];
        const items = factIds.length > 0 ? input.facts.filter((f) => factIds.includes(f.key)) : input.facts;
        if (items.length > 0) {
          sections.push({ id: sec.id, title: '关键事实', content: items.map((f) => `· ${f.key}：${f.value}`).join('\n'), citations: [], from: sec.from });
        }
        break;
      }
      case 'core.rules': {
        const prefix = sec.rulePrefix;
        const hits = prefix ? input.ruleHits.filter((r) => r.ruleId.startsWith(prefix)) : input.ruleHits;
        if (hits.length > 0) {
          sections.push({
            id: sec.id,
            title: '卦象信号',
            content: hits.map((r) => `· [${r.severity}] ${r.text}`).join('\n'),
            citations: hits.flatMap((r) => r.citations),
            from: sec.from,
          });
        }
        break;
      }
      case 'answer.timing': {
        const candidates = input.timingCandidates.filter((t) => !sec.rulePrefix || t.ruleId.startsWith(sec.rulePrefix));
        if (candidates.length > 0) {
          sections.push({ id: sec.id, title: '应期参考', content: candidates.map((t) => `· ${t.text}`).join('\n'), citations: candidates.flatMap((c) => c.citations), from: sec.from });
        } else {
          gaps.push(sec.fallback ?? '暂无内置应期推法');
        }
        break;
      }
      case 'knowledge.retrieve': {
        const hits = input.evidence;
        if (hits.length >= (sec.minHits ?? 1)) {
          sections.push({ id: sec.id, title: '原文依据', content: hits.map((h) => `· ${h.segment}`).join('\n'), citations: hits.map((h) => h.citation), from: sec.from });
        } else {
          gaps.push(sec.fallback ?? '此流派暂无内置依据，请导入书库');
        }
        break;
      }
      case 'ai.language': {
        if (input.aiCard) {
          sections.push({ id: sec.id, title: '综合权衡', content: input.aiCard.text, citations: [], from: sec.from });
        }
        break;
      }
      default:
        break;
    }
  }

  // 敏感项拦截
  if (input.questionText) {
    const s = safetyCheck(input.questionText);
    if (s.blocked) {
      sections.unshift({ id: 'safety', title: '注意', content: s.guidance.join('\n'), citations: [], from: 'answer.safety' });
    }
  }

  return { sections, gaps, disclaimer: DISCLAIMER };
}
