/**
 * 应期推法（ruleId 化，v5 §0.4 / §3.1 answer.timing）
 * 各术数按盘面字段直接推应期候选；全部 D 级「流派说法」，citations 留空不伪造引文。
 * 供 answer.timing 段落与 UI「应期参考」卡片使用。
 */

import type { RuleHit, TimingCandidate } from '@xuanshu/core';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_HE: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
};

function t(ruleId: string, text: string, window: string): TimingCandidate {
  return { ruleId, text, window, citations: [], confidenceLevel: 'D' };
}

type Unknown = Record<string, unknown>;

function num(o: unknown): number | undefined {
  return typeof o === 'number' ? o : undefined;
}

/** 六爻：从 ruleHits 提取 liuyao.timing，并叠加各爻应期机制 */
function liuyaoTiming(chart: Unknown, ruleHits: RuleHit[]): TimingCandidate[] {
  const out: TimingCandidate[] = [];
  for (const r of ruleHits) {
    if (r.ruleId.startsWith('liuyao.timing')) {
      out.push(t(r.ruleId, r.text, r.text.replace('应期参考：', '').split('；')[0] ?? '近日'));
    }
  }
  const lines = (chart['lines'] as Unknown[] | undefined) ?? [];
  for (const l of lines) {
    const branch = l?.['branch'] as string | undefined;
    const moving = l?.['moving'] === true;
    const xunKong = l?.['xunKong'] === true;
    const yuePo = l?.['yuePo'] === true;
    if (!branch || !DIZHI.includes(branch)) continue;
    const chong = DIZHI[(DIZHI.indexOf(branch) + 6) % 12]!;
    if (moving) out.push(t('liuyao.timing.dong', `${branch}爻动，应于逢${branch}日/逢${ZHI_HE[branch] ?? ''}合日`, `约${branch}日前后`));
    if (xunKong) out.push(t('liuyao.timing.xunkong', `${branch}爻旬空，待出空（${chong}日冲空）`, `出空旬内`));
    if (yuePo) out.push(t('liuyao.timing.yuepo', `${branch}爻月破，待${chong}日补破`, `补破之月内`));
  }
  return out;
}

/** 梅花：体用卦数与动爻数 → 应数以日/月为尺 */
function meihuaTiming(chart: Unknown): TimingCandidate[] {
  const numMap: Record<string, number> = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 };
  const yong = chart['yong'] as string | undefined;
  const ti = chart['ti'] as string | undefined;
  const mi = num(chart['movingIndex']);
  if (!yong || !ti) return [t('meihua.timing.none', '未知动爻，暂无法推应期', '近期')];
  const y = numMap[yong] ?? 0;
  const x = numMap[ti] ?? 0;
  const span = Math.abs(y - x);
  const n = mi !== undefined ? mi + 1 : (y || 3);
  return [
    t('meihua.timing.guashu', `体用先天数差${span}，动爻${n}，应期以约${n}（日/月）为尺`, `约${n}日内`),
  ];
}

/** 小六壬：末宫数位 + 三宫五行链缓急 */
function xiaoliurenTiming(chart: Unknown): TimingCandidate[] {
  const mo = chart['mo'] as Unknown | undefined;
  const idx = num(mo?.['index']);
  const name = mo?.['name'] as string | undefined;
  if (!idx) return [t('xiaoliuren.timing.none', '末宫未明，暂以近期为应', '近日')];
  const n = ((idx - 1) % 6) + 1;
  return [
    t('xiaoliuren.timing.mo', `末宫${name}（第${idx}宫），应期以约${n * 2 - 1}（日/旬）为参考`, `约${n * 2 - 1}日内`),
  ];
}

/** 奇门：时干落宫数 + 值使门缓急 + 空亡出空 */
function qimenTiming(chart: Unknown): TimingCandidate[] {
  const hp = num(chart['hourGanPalace']);
  const term = chart['term'] as string | undefined;
  const out: TimingCandidate[] = [];
  if (hp) {
    const n = ((hp - 1) % 9) + 1;
    out.push(t('qimen.timing.palace', `时干落${hp}宫，应期以约${n}日（局数参考）为度`, `约${n}日内`));
  }
  const xk = chart['xunKong'] as string | undefined;
  if (xk) out.push(t('qimen.timing.kong', `旬空「${xk}」填实出空之期见动静`, '出空前后'));
  if (term) out.push(t('qimen.timing.term', `${term}节气当令期间为应期范围`, `${term}期间`));
  return out;
}

/** 大六壬：驿马速迟 + 旬空用神 + 三传取数 */
function liurenTiming(chart: Unknown): TimingCandidate[] {
  const out: TimingCandidate[] = [];
  const ym = chart['yiMa'] as string | undefined;
  const chu = chart['chuChuan'] as string | undefined;
  if (ym && ym === chu) out.push(t('liuren.timing.yima', `用神临驿马，主事速而多变，应期迅速`, '近日'));
  else if (ym) out.push(t('liuren.timing.yima', `驿马在${ym}，事有迁动之机`, '近期'));
  const xk = (chart['xunKongBranches'] as string[] | undefined) ?? [];
  if (chu && xk.includes(chu)) out.push(t('liuren.timing.kong', `用神${chu}落旬空，应期迟滞，待出空`, '出空后'));
  const idx = chu ? (DIZHI.indexOf(chu) % 6) + 1 : undefined;
  if (idx) out.push(t('liuren.timing.san', `三传之数应期以约${idx}（日/旬）为参考`, `约${idx}日内`));
  return out;
}

/** 金口诀：地分与月将生克十数以应期 */
function jinkouTiming(chart: Unknown): TimingCandidate[] {
  const dif = chart['diFen'] as string | undefined;
  const yj = chart['yueJiang'] as string | undefined;
  if (!dif) return [t('jinkou.timing.none', '地分未明，暂以近期为应', '近日')];
  const n = (DIZHI.indexOf(dif) % 6) + 1;
  const out = [t('jinkou.timing.difen', `地分${dif}（第${DIZHI.indexOf(dif) + 1}支），应期以约${n}（日/月）为参考`, `约${n}日内`)];
  if (yj) out.push(t('jinkou.timing.jiang', `月将${yj}为事体，生地分主事进、克地分主事阻`, `${yj}月将当值期间`));
  return out;
}

/** 八字：大运分段，近期转折在大运交界处 */
function baziTiming(chart: Unknown): TimingCandidate[] {
  const dayun = (chart['dayun'] as Unknown[] | undefined) ?? [];
  const out: TimingCandidate[] = [];
  for (const d of dayun.slice(0, 2)) {
    const startYear = num(d?.['startYear']);
    const gz = d?.['ganZhi'] as { gan?: string; zhi?: string } | undefined;
    if (startYear && gz) out.push(t('bazi.timing.dayun', `${startYear}年入${gz.gan ?? ''}${gz.zhi ?? ''}大运，为运势转折之年`, `${startYear}年后`));
  }
  if (out.length === 0) out.push(t('bazi.timing.none', '大运未明，宜以流年回标校准', '流年内'));
  return out;
}

/** 紫微：大限区间 */
function ziweiTiming(chart: Unknown): TimingCandidate[] {
  const decadal = (chart['decadal'] as Unknown[] | undefined) ?? [];
  const out: TimingCandidate[] = [];
  for (const d of decadal.slice(0, 2)) {
    const range = d?.['range'] as string | undefined;
    if (range) out.push(t('ziwei.timing.day', `大限：${range}`, range));
  }
  if (out.length === 0) out.push(t('ziwei.timing.none', '大限未明，宜以流年回标校准', '流年内'));
  return out;
}

/** 汇总：按术数输出应期候选（D 级） */
export function timingCandidatesOf(art: string, chart: Unknown, ruleHits: RuleHit[] = []): TimingCandidate[] {
  switch (art) {
    case 'liuyao': return liuyaoTiming(chart, ruleHits);
    case 'meihua': return meihuaTiming(chart);
    case 'xiaoliuren': return xiaoliurenTiming(chart);
    case 'qimen': return qimenTiming(chart);
    case 'liuren': return liurenTiming(chart);
    case 'jinkou': return jinkouTiming(chart);
    case 'bazi': return baziTiming(chart);
    case 'ziwei': return ziweiTiming(chart);
    default: return [];
  }
}