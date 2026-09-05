/**
 * 六爻用神断与伏神/旺衰（yongShen 规则集，补充 chartRules 之外的高级断）
 * 等级：全部 D 级「流派说法」，citations 留空不伪造引文。
 * 内容：
 *   1. 世爻用神：取世爻所临六亲为「身之所系」，作为通用用神倾向
 *   2. 六亲旺衰一览：按五行旺相休囚死（月令）＋旬空/月破/日冲修正
 *   3. 伏神/飞神：伏神是否透出、被飞神所压，出伏之机
 */

import type { RuleHit } from '../../types.js';
import { ZHI_WUXING, WUXING_SHENG, WUXING_KE, type WuXing, type Zhi } from '../../calendar/ganzhi.js';
import type { LiuyaoChart, LiuyaoLine } from './engine.js';

export type WangShuaiLevel = '旺' | '相' | '休' | '囚' | '死';

const ZHI_WX = ZHI_WUXING as Record<Zhi, WuXing>;
const SHENG = WUXING_SHENG;
const KE = WUXING_KE;

/** 月令（月支五行）当令 → 旺相休囚死（与梅花/六壬同一五行环） */
export function liuyaoWangShuaiOf(wx: WuXing, monthWx: WuXing): WangShuaiLevel {
  if (wx === monthWx) return '旺';
  if (SHENG[monthWx] === wx) return '相';
  if (SHENG[wx] === monthWx) return '休';
  if (KE[wx] === monthWx) return '囚';
  return '死';
}

export interface LineStrength {
  line: LiuyaoLine;
  wangShuai: WangShuaiLevel;
  flags: string[];
  /** 综合：旺相且无空破冲 → true */
  strong: boolean;
}

/** 逐爻旺衰（月令为主，旬空/月破/日冲为权） */
export function lineStrengths(chart: LiuyaoChart): LineStrength[] {
  const monthWx = ZHI_WX[chart.monthPillar.zhi];
  return chart.lines.map((l) => {
    const wangShuai = liuyaoWangShuaiOf(ZHI_WX[l.branch], monthWx);
    const flags: string[] = [];
    if (l.xunKong) flags.push('旬空');
    if (l.yuePo) flags.push('月破');
    if (l.riChong) flags.push('日冲');
    if (l.moving) flags.push('动');
    const strong = (wangShuai === '旺' || wangShuai === '相') && flags.filter((f) => f !== '动').length === 0;
    return { line: l, wangShuai, flags, strong };
  });
}

/** 用神断规则集（D 级） */
export function yongShenRules(chart: LiuyaoChart): RuleHit[] {
  const rules: RuleHit[] = [];
  const strengths = lineStrengths(chart);
  const monthWx = ZHI_WX[chart.monthPillar.zhi];
  const shi = chart.lines.find((l) => l.isShi);

  // 世爻用神（通用取法：世为人身，所临六亲即我之事体）
  if (shi) {
    const s = strengths.find((x) => x.line.index === shi.index)!;
    rules.push({
      ruleId: `liuyao.yongshen.shi.${shi.liuqin}`,
      text: `世爻临${shi.liuqin}（${shi.stem}${shi.branch}），以${shi.liuqin}为用神之体；${shi.liuqin}在月令（${chart.monthPillar.zhi}月）为「${s.wangShuai}」${s.flags.length ? `，逢${s.flags.join('、')}` : ''}。`,
      severity: s.strong ? '吉' : s.wangShuai === '死' || s.flags.includes('月破') ? '凶' : '变数',
      confidenceLevel: 'D',
      citations: [],
    });
  }

  // 六亲旺衰一览：按六亲找最强/最弱爻
  const byQin = new Map<string, LineStrength[]>();
  for (const s of strengths) {
    const list = byQin.get(s.line.liuqin) ?? [];
    list.push(s);
    byQin.set(s.line.liuqin, list);
  }
  const qiQin = [...byQin.entries()].filter(([, list]) => list.length > 0);
  const strongest = qiQin
    .map(([qin, list]) => ({ qin, n: list.filter((x) => x.strong).length, total: list.length }))
    .sort((a, b) => b.n - a.n)[0];
  if (strongest && strongest.n > 0) {
    rules.push({
      ruleId: `liuyao.yongshen.qiang.${strongest.qin}`,
      text: `旺相之${strongest.qin}爻为主力（${strongest.n}/${strongest.total}得地），主该六亲所主人事有力；衰破之${strongest.qin}爻宜防其失。`,
      severity: '提示',
      confidenceLevel: 'D',
      citations: [],
    });
  }

  // 伏神：伏藏之六亲是否可出
  const fu = chart.lines.filter((l) => l.fuShen);
  if (fu.length > 0) {
    const parts = fu.map((l) => {
      const v = l.fuShen!;
      const s = strengths.find((x) => x.line.index === l.index)!;
      return `${v.qin}（${v.stem}${v.branch}）伏于${l.liuqin}${l.branch}之下${s.flags.includes('月破') || s.wangShuai === '死' ? '，乘忌主藏在之机' : '，飞神旺则伏神难出'}`;
    });
    rules.push({
      ruleId: 'liuyao.fushen',
      text: `伏神：${parts.join('；')}。伏神待出值/冲扶之时露出。`,
      severity: '变数',
      confidenceLevel: 'D',
      citations: [],
    });
  }

  // 月令总评
  rules.push({
    ruleId: 'liuyao.yueling',
    text: `月令在${chart.monthPillar.zhi}（五行${monthWx}），全局以五行「${monthWx}」为当令，用神得月令生扶者气旺。`,
    severity: '提示',
    confidenceLevel: 'D',
    citations: [],
  });

  return rules;
}