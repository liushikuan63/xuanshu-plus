/**
 * 插件契约 v5（含 intake / answer / playbook / reader 声明位）
 * 所有输出 JSON 携带 configHash，保证可复现、可 diff。
 */

import type { ArtType, CategoryId, CitationRef, ConfidenceLevel, EngineCtx, NormalizedMoment, RawInput, RuleHit, SubCategoryId, Warning } from '../types.js';
import type { BoardSpec } from '../board/schema.js';

/** 运行时配置（各术数），JSON 序列化后进入 configHash */
export type ResolvedConfig = Record<string, unknown>;

/** 配置快照 */
export interface ConfigSnapshot {
  config: ResolvedConfig;
  configHash: string;
}

export interface EvidenceRequest {
  ruleId: string;
  keywords: string[];
  note?: string;
}

/** 事项分类声明（intake） */
export interface CategoryDef {
  id: CategoryId;
  subCategories: SubCategoryId[];
  /** 推荐术数（按优先级） */
  recommendedArts: ArtType[];
  keyFactors: KeyFactor[];
  guidance: string;
  forbidden: string[];
}

export interface KeyFactor {
  name: string;
  label: string;
  type: 'text' | 'number' | 'enum' | 'date';
  options?: string[];
  required: boolean;
  hint: string;
}

export interface GuidanceBlock {
  whyAsk: string;
  goodExamples: string[];
  badExamples: Array<{ text: string; why: string }>;
  tips: string[];
}

/** 应期候选 */
export interface TimingCandidate {
  ruleId: string;
  text: string;
  citations: CitationRef[];
  confidenceLevel: ConfidenceLevel;
  /** 建议的时间窗口描述 */
  window: string;
}

/** 事实束（提取自盘面 + 事项） */
export interface FactBundle {
  key: string;
  value: string;
  source: 'core.compute' | 'core.rules' | 'knowledge' | 'ai';
}

/** 答复模板段落 */
export interface AnswerTemplate {
  templateId: string;
  category: string;
  sections: Array<{
    id: string;
    from: 'composer' | 'core.extractFacts' | 'core.rules' | 'answer.timing' | 'knowledge.retrieve' | 'ai.language' | 'answer.safety';
    require?: string[];
    facts?: string[];
    rulePrefix?: string;
    minHits?: number;
    fallback?: string;
    always?: boolean;
  }>;
  forbidden: string[];
  recordHint: string;
}

/** 断事路径卡 playbook（v5 §6） */
export interface Playbook {
  id: string;
  category: CategoryId;
  subCategory?: SubCategoryId;
  version: number;
  arts: {
    primary: ArtType;
    alternates: Array<{ art: ArtType; reason: string }>;
    whyPrimary: string;
  };
  howToAsk: {
    goodExamples: string[];
    badExamples: Array<{ text: string; why: string }>;
    requiredFields: Array<'who' | 'what' | 'timeRange' | 'options' | 'location' | 'needTiming'>;
    clarify: Array<{ id: string; text: string }>;
  };
  howToCast: CastingGuide;
  yongShen: Array<{
    condition: string;
    yongShen: string;
    ruleId: string;
    citations: CitationRef[];
    confidenceLevel: ConfidenceLevel;
  }>;
  signals: Array<{
    name: string;
    meaning: '吉' | '凶' | '变数';
    ruleId: string;
    citations: CitationRef[];
    confidenceLevel: ConfidenceLevel;
  }>;
  locating?: {
    byGuaGong?: string;
    byYaoWei?: Record<number, string>;
    byDiZhi?: Record<string, { dir: string; places: string[] }>;
    byLiuShen?: Record<string, string>;
    ruleId: string;
    citations: CitationRef[];
    confidenceLevel: ConfidenceLevel;
  };
  timing: {
    rules: Array<{ name: string; ruleId: string; citations: CitationRef[]; confidenceLevel: ConfidenceLevel }>;
    fallback: string;
  };
  readingList: Array<{
    canonicalId: string;
    book: string;
    chapter: string;
    segIds?: string[];
    why: string;
    priority: 1 | 2 | 3;
  }>;
  forbidden: string[];
  disclaimer: string;
  recordTemplate: {
    fields: Array<{ key: string; label: string; type: 'text' | 'number' | 'date' | 'enum'; options?: string[] }>;
    hint: string;
  };
}

export interface CastingGuide {
  methods: Array<{
    name: string;
    steps: string[];
    arts: ArtType[];
  }>;
  tips: string[];
}

/**
 * 术数插件契约：实现某一种术数的全部能力
 */
export interface ShuPlugin<I = unknown, C = unknown> {
  id: string;
  name: string;
  version: string;
  art: ArtType;
  category: 'paipan' | 'kb' | 'ai';
  configSchema: Record<string, unknown>;
  normalize(input: RawInput, ctx: EngineCtx): Promise<NormalizedMoment>;
  compute(input: RawInput, ctx: EngineCtx, cfg: ResolvedConfig): Promise<C>;
  rules(chart: C, cfg: ResolvedConfig): Promise<RuleHit[]>;
  board(chart: C, cfg: ResolvedConfig): BoardSpec;
  evidence(chart: C, rules: RuleHit[]): EvidenceRequest[];
  warnings(chart: C, cfg: ResolvedConfig): Warning[];
  knowledgePack: { id: string; refs: string[] };
  fixtures: Array<{ input: RawInput; gold: string }>;
  intake: {
    categories: CategoryId[];
    presetFor(category: CategoryId, sub: SubCategoryId): Partial<ResolvedConfig>;
    guidance(category: CategoryId): GuidanceBlock;
    keyFactors(category: CategoryId): KeyFactor[];
  };
  answer: {
    templateFor(category: CategoryId): AnswerTemplate;
    timingRules(chart: C, cfg: ResolvedConfig): TimingCandidate[];
    extractFacts(chart: C, category: CategoryId): FactBundle[];
  };
  playbook?: Playbook;
}
