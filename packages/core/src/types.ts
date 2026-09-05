/**
 * 玄枢共享领域类型
 */

export type ArtType = 'bazi' | 'liuyao' | 'meihua' | 'qimen' | 'liuren' | 'xiaoliuren' | 'jinkou' | 'ziwei';

export const ART_TYPES: ArtType[] = ['bazi', 'liuyao', 'meihua', 'qimen', 'liuren', 'xiaoliuren', 'jinkou', 'ziwei'];

export type CategoryId =
  | '求财' | '事业' | '感情' | '学业' | '健康' | '出行' | '官非'
  | '失物' | '择日' | '家宅' | '生育' | '合作' | '决策' | '其他';

export type SubCategoryId = string;

/** 五档可信度（v5 §9.4 / 附录 F） */
export type ConfidenceLevel = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * 引用模型 CitationRef：精确定位「哪本书、哪章、哪段、哪几个字」
 */
export interface CitationRef {
  canonicalId: string;         // 典籍唯一 ID
  book: string;
  author?: string;
  edition: string;
  chapter: string;
  segId: string;
  charRange?: [number, number];
  quote: string;
  page?: string;
  license: '公有领域' | '用户自有' | '未知';
  sourceUrl?: string;
  accessedAt?: string;
  confidenceLevel: ConfidenceLevel;
  transcriptionConfidence?: number;
}

/** 规则命中（所有术数规则的统一输出） */
export interface RuleHit {
  ruleId: string;
  text: string;
  confidenceLevel: ConfidenceLevel;
  citations: CitationRef[];
  severity: '吉' | '凶' | '变数' | '提示';
  /** 供 UI 展示的结构化细节 */
  detail?: Record<string, unknown>;
}

export interface Warning {
  code: string;
  message: string;
  level: 'info' | 'warn' | 'block';
}

/** 归一化时刻（排盘输入） */
export interface NormalizedMoment {
  year: number;
  month: number;
  day: number;
  hour: number;       // 0–23
  minute: number;
  second: number;
  /** 儒略日（UT） */
  jd: number;
  /** 儒略日数（整数，当地 0 点） */
  jdn: number;
  tzOffsetHours: number;
  /** 用户提供经度时才启用真太阳时 */
  longitude?: number;
  trueSolarHour?: number;
  /** 日柱干支索引 0..59 */
  dayGanZhiIndex: number;
  /** 旬空（两字） */
  xunKong: string;
}

/** 原始输入（用户侧） */
export interface RawInput {
  kind: 'time' | 'manual' | 'random' | 'numbers' | 'words';
  /** manual：六爻爻值字符串，如 '787978'（初→上） */
  text?: string;
  numbers?: number[];
  /** words：字占 */
  words?: string;
  time?: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
    tzOffsetHours?: number;
  };
}

export interface EngineCtx {
  /** 当前时刻（注入以便测试） */
  now: Date;
  /** 随机源（注入以便测试/确定性复现） */
  random: () => number;
  tzOffsetHours: number;
}
