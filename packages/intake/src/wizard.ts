/**
 * 6 步引导式起卦向导 IntakeWizard（v5 §0.4）
 */

import type { ArtType, CategoryId, EngineCtx, RawInput } from '@xuanshu/core';
import { categoryDef, sensitiveCategories } from './taxonomy.js';
import { playbookFor } from './playbooks.js';

export interface WizardState {
  step: 0 | 1 | 2 | 3 | 4 | 5;
  category?: CategoryId;
  subCategory?: string;
  questionText?: string;
  structured: Record<string, string | boolean | string[] | undefined>;
  recommendedArt?: ArtType;
  input?: RawInput;
  summary?: string;
  blocked?: { reason: string; guidance: string };
}

export interface WizardResult {
  state: WizardState;
  nextStep: WizardState['step'];
  prompts: string[];
  warnings: string[];
}

const STEPS = ['选事项', '细化问法', '推荐术数', '输入/起卦', '出盘解释', '记录标注'] as const;

export class IntakeWizard {
  private state: WizardState = { step: 0, structured: {} };

  current(): WizardState {
    return this.state;
  }

  /** 第一步：选事项 */
  chooseCategory(category: CategoryId, subCategory?: string): WizardResult {
    const def = categoryDef(category);
    this.state = { step: 1, category, subCategory, structured: {} };
    const prompts = [def.guidance];
    if (sensitiveCategories().includes(category)) {
      this.state.blocked = {
        reason: `${category}属于敏感事项`,
        guidance: '仅提供趋势参考，不提供医疗/法律/生育等确定性结论；必要时请咨询专业机构。',
      };
      prompts.push(this.state.blocked.guidance);
    }
    return this.result(prompts);
  }

  /** 第二步：细化问法（含质量检查） */
  refineQuestion(text: string): WizardResult {
    if (!this.state.category) throw new Error('请先选事项');
    const q = assessQuestion(text, this.state.category);
    this.state.structured = mergeStructured(this.state.structured, q.extracted);
    this.state.questionText = text;
    const def = categoryDef(this.state.category);
    const missing = def.keyFactors.filter((f) => f.required && !q.extracted[f.name]);
    const prompts = q.prompts;
    if (missing.length > 0) {
      this.state.step = 1;
      prompts.push(`还缺：${missing.map((m) => m.label).join('、')}`);
      return this.result(prompts, q.warnings);
    }
    this.state.step = 2;
    return this.result(prompts, q.warnings);
  }

  /** 第三步：确认术数（默认推荐） */
  confirmArt(art: ArtType): WizardResult {
    if (!this.state.category) throw new Error('请先选事项');
    this.state.recommendedArt = art;
    this.state.step = 3;
    const pb = playbookFor(this.state.category, this.state.subCategory);
    const prompts: string[] = [];
    if (pb) {
      prompts.push(`已加载断事路径卡《${pb.id}》：怎么问/怎么起/取用神/读哪本书都有指引。`);
      prompts.push(pb.howToCast.tips.join('；'));
    }
    return this.result(prompts);
  }

  /** 第四步：输入/起卦 */
  submitInput(input: RawInput): WizardResult {
    if (!this.state.category) throw new Error('请先选事项');
    this.state.input = input;
    this.state.summary = summarize(this.state);
    this.state.step = 4;
    return this.result([`问题摘要：${this.state.summary}`, '出盘后可逐格点按查看解释与出处。']);
  }

  /** 第五步：出盘（由调用方排盘后调用） */
  completeChart(): WizardResult {
    this.state.step = 5;
    return this.result(['可点击出处角标跳转典籍原文；未命中引用会提示「请导入书库」。']);
  }

  private result(prompts: string[], warnings: string[] = []): WizardResult {
    return { state: this.state, nextStep: this.state.step, prompts, warnings };
  }
}

/** 问句质量评估（v5 §6.8） */
export function assessQuestion(text: string, category: CategoryId): { warnings: string[]; prompts: string[]; extracted: Record<string, string> } {
  const warnings: string[] = [];
  const prompts: string[] = [];
  const extracted: Record<string, string> = {};
  const def = categoryDef(category);
  if (text.length < 4) {
    warnings.push('问句过短');
    prompts.push('描述尽量包含「谁、什么事、什么时间、要什么结果」。');
  }
  if (/会不会成功|怎么样|好不好/.test(text)) {
    warnings.push('问句过泛');
    prompts.push('建议拆成「具体事项 + 时限」，例如「我投的 A 公司岗位一个月内能否拿到 offer」。');
  }
  if (category === '失物') {
    const m = text.match(/(身份证|钱包|手机|戒指|钥匙|证件|书|卡|包|手表|耳机)/);
    if (m) extracted['what'] = m[1] ?? m[0];
    const when = text.match(/(昨天|前天|今天|上周|上个月|前天晚上|\d+天前)/);
    if (when) extracted['lostAt'] = when[1] ?? when[0];
    const stolen = text.match(/(偷|盗|贼)/);
    const picked = text.match(/(被人拿走|捡走|被人捡|被拿走|不见了)/);
    if (stolen) extracted['isStolen'] = '是';
    else if (picked) extracted['isStolen'] = '不确定';
    if (!m) {
      prompts.push('取用神需要先知道丢的是什么——证件取父母爻、钱包取妻财爻，差别很大。');
    }
  }
  if (category === '感情') {
    const status = text.match(/(已婚|恋爱|分手|相亲|暗恋)/);
    if (status) extracted['status'] = status[0];
  }
  if (category === '事业') {
    const item = text.match(/(求职|升迁|创业|考公|项目|offer|投标|面试|跳槽)/);
    if (item) extracted['item'] = item[0];
  }
  for (const f of def.keyFactors) {
    const m = text.match(new RegExp(f.name));
    if (m) extracted[f.name] = m[0];
  }
  const limit = text.match(/(\d+天内|\d+个月|今年|明年|三个月|半年|Q\d)/);
  if (limit) extracted['timeRange'] = limit[0];
  return { warnings, prompts, extracted };
}

function mergeStructured(base: WizardState['structured'], extra: Record<string, string>): WizardState['structured'] {
  return { ...base, ...extra } as WizardState['structured'];
}

export function summarize(state: WizardState): string {
  const parts: string[] = [state.category ?? '其他'];
  if (state.structured.what) parts.push(state.structured.what as string);
  if (state.structured.timeRange) parts.push(`时限:${state.structured.timeRange}`);
  if (state.questionText) parts.push(`「${state.questionText}」`);
  return parts.join(' | ');
}

export function stepLabel(step: number): string {
  return STEPS[step] ?? '';
}

export function steps(): readonly string[] {
  return STEPS;
}

export function defaultCtx(now = new Date()): EngineCtx {
  return { now, random: Math.random, tzOffsetHours: 8 };
}
