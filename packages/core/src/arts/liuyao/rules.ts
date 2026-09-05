/**
 * 六爻断卦规则（ruleId 化）
 * 引用纪律（v5）：凡能回链本仓《周易》卦辞/爻辞原文者标 A 级；
 * 未入语料库的断法口诀一律空 citations，由知识层补齐或显示缺口，绝不伪造引文。
 */

import type { CitationRef, ConfidenceLevel, RuleHit } from '../../types.js';
import { zhiChong } from '../../calendar/ganzhi.js';
import { hexagramText } from './hexagramTexts.js';
import type { LiuyaoChart, LiuyaoLine } from './engine.js';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 地支六合 */
const ZHI_HE: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
};

/** 三合局 */
const SAN_HE: Record<string, string[]> = {
  申: ['申', '子', '辰'], 子: ['申', '子', '辰'], 辰: ['申', '子', '辰'],
  亥: ['亥', '卯', '未'], 卯: ['亥', '卯', '未'], 未: ['亥', '卯', '未'],
  寅: ['寅', '午', '戌'], 午: ['寅', '午', '戌'], 戌: ['寅', '午', '戌'],
  巳: ['巳', '酉', '丑'], 酉: ['巳', '酉', '丑'], 丑: ['巳', '酉', '丑'],
};

function zhouyiCitation(name: string, line?: number): CitationRef | null {
  const t = hexagramText(name);
  if (!t) return null;
  const quote = line === undefined ? t.guaci : (t.yaoci[line] ?? null);
  if (!quote) return null;
  return {
    canonicalId: 'zhouyi.guaci',
    book: '周易',
    edition: '通行本（公有领域）',
    chapter: `${name}${line === undefined ? '·卦辞' : `·${['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][line]!}`}`,
    segId: `zhouyi.${t.name}.${line === undefined ? 'guaci' : line + 1}`,
    quote,
    license: '公有领域',
    confidenceLevel: 'A',
  };
}

/** 《增删卜易》原文引用（公有领域转录，segId 定位到句） */
function zsbyCitation(segId: string, quote: string): CitationRef {
  return {
    canonicalId: 'zengshanbuyi.ws.1912',
    book: '增删卜易',
    author: '野鹤老人',
    edition: '公有领域转录（网络流传本）',
    chapter: segId.split('.').slice(0, 2).join('.'),
    segId,
    quote,
    license: '公有领域',
    confidenceLevel: 'A',
  };
}

function hit(ruleId: string, text: string, severity: RuleHit['severity'], level: ConfidenceLevel, citations: CitationRef[] = []): RuleHit {
  return { ruleId, text, severity, confidenceLevel: level, citations };
}

/** 旬空爻 */
export function xunKongLines(chart: LiuyaoChart): LiuyaoLine[] {
  return chart.lines.filter((l) => l.xunKong);
}

/** 月破爻 */
export function yuePoLines(chart: LiuyaoChart): LiuyaoLine[] {
  return chart.lines.filter((l) => l.yuePo);
}

/** 日辰冲：静爻为暗动，动爻为冲散 */
export function riChongLines(chart: LiuyaoChart): LiuyaoLine[] {
  return chart.lines.filter((l) => l.riChong);
}

/** 六冲卦：初四、二五、三上 三组同位皆冲 */
export function isLiuChong(chart: LiuyaoChart): boolean {
  const [a, b, c] = [chart.lines[0]!, chart.lines[1]!, chart.lines[2]!];
  const [d, e, f] = [chart.lines[3]!, chart.lines[4]!, chart.lines[5]!];
  return zhiChong(a.branch) === d.branch && zhiChong(b.branch) === e.branch && zhiChong(c.branch) === f.branch;
}

/** 六合卦：三组同位皆合 */
export function isLiuHe(chart: LiuyaoChart): boolean {
  const [a, b, c] = [chart.lines[0]!, chart.lines[1]!, chart.lines[2]!];
  const [d, e, f] = [chart.lines[3]!, chart.lines[4]!, chart.lines[5]!];
  return ZHI_HE[a.branch] === d.branch && ZHI_HE[b.branch] === e.branch && ZHI_HE[c.branch] === f.branch;
}

/** 三合局：三爻地支成局且中神动 */
export function sanHeJu(chart: LiuyaoChart): Array<{ group: string[]; middleMoving: boolean }> {
  const branches = chart.lines.map((l) => l.branch);
  const moving = chart.lines.map((l) => l.moving);
  const out: Array<{ group: string[]; middleMoving: boolean }> = [];
  for (const [key, group] of Object.entries(SAN_HE)) {
    const idx = group.map((b) => branches.indexOf(b as never));
    if (idx.every((i) => i >= 0)) {
      const middle = key;
      const middleIdx = branches.indexOf(middle as never);
      out.push({ group: [...group], middleMoving: middleIdx >= 0 && moving[middleIdx] === true });
    }
  }
  return out;
}

/** 世应关系 */
export function shiYingRelation(chart: LiuyaoChart): { shi: LiuyaoLine; ying: LiuyaoLine; relation: '冲' | '合' | '生' | '克' | '比和' } {
  const shi = chart.lines.find((l) => l.isShi)!;
  const ying = chart.lines.find((l) => l.isYing)!;
  if (zhiChong(shi.branch) === ying.branch) return { shi, ying, relation: '冲' };
  if (ZHI_HE[shi.branch] === ying.branch) return { shi, ying, relation: '合' };
  return { shi, ying, relation: '比和' };
}

/** 六爻断卦主规则集合 */
export function chartRules(chart: LiuyaoChart): RuleHit[] {
  const rules: RuleHit[] = [];
  const ben = hexagramText(chart.benName);
  const bian = chart.bianName ? hexagramText(chart.bianName) : null;

  // 本卦卦辞（A 级，可回链）
  if (ben) {
    rules.push(hit('liuyao.ben.guaci', `本卦《${chart.benName}》卦辞：${ben.guaci}`, '提示', 'A', [zhouyiCitation(chart.benName)!]));
  }
  if (bian && chart.movingIndices.length > 0) {
    rules.push(hit('liuyao.bian.guaci', `变卦《${chart.bianName}》卦辞：${bian.guaci}`, '提示', 'A', [zhouyiCitation(chart.bianName!)!]));
  }
  // 动爻爻辞
  for (const mi of chart.movingIndices) {
    const yao = chart.lines[mi]!;
    const text = hexagramText(chart.benName);
    if (text) {
      const quote = text.yaoci[mi];
      rules.push(
        hit('liuyao.dong.yaoci', `第${mi + 1}爻动（${yao.stem}${yao.branch}${yao.liuqin}）：${quote}`, '变数', 'A', [zhouyiCitation(chart.benName, mi)!]),
      );
    }
  }

  // 六冲卦
  if (isLiuChong(chart)) {
    rules.push(hit('liuyao.liuchong', `本卦《${chart.benName}》六爻相冲，为六冲卦，主事多速而多变、难以长久。`, '变数', 'A', [zsbyCitation('zsby.c25.4', '冲者散也，凡占凶事宜于冲散、占吉事而不宜，必兼用神而言，用神旺虽冲不破，用神失陷凶而又凶')]));
  }
  // 六合卦
  if (isLiuHe(chart)) {
    rules.push(hit('liuyao.liuhe', `本卦《${chart.benName}》六爻相合，为六合卦，主事多和合、拖延而难散。`, '吉', 'A', [zsbyCitation('zsby.c24.9', '卦逢六合者即如天地否卦内外六爻自相和合是也，不动亦是。')]));
  }
  // 旬空
  const xk = xunKongLines(chart);
  if (xk.length > 0) {
    rules.push(hit('liuyao.xunkong', `旬空：${xk.map((l) => `${l.liuqin}爻（${l.branch}）`).join('、')}逢空，主其对应人事暂无力、待出空填实。`, '变数', 'A', [zsbyCitation('zsby.c31.2', '如甲子至癸酉日为一旬，此十日之内，并无戌亥，以爻逢戌亥为空亡，又名旬空，馀仿此。')]));
  }
  // 月破
  const yp = yuePoLines(chart);
  if (yp.length > 0) {
    rules.push(hit('liuyao.yuepo', `月破：${yp.map((l) => `${l.liuqin}爻（${l.branch}）`).join('、')}遭月破，主其对应人事受损、待补破。`, '凶', 'A', [zsbyCitation('zsby.c36.1', '正申、二酉、三戌，四亥、五子、六丑、七寅、八卯、九辰，十巳、十一午、十二未，月建冲之为月破，逐月之破日是也。')]));
  }
  // 日辰冲（暗动/冲散）
  const rc = riChongLines(chart);
  if (rc.length > 0) {
    const dark = rc.filter((l) => !l.moving).map((l) => `${l.liuqin}爻（${l.branch}）`).join('、');
    const loose = rc.filter((l) => l.moving).map((l) => `${l.liuqin}爻（${l.branch}）`).join('、');
    if (dark) rules.push(hit('liuyao.andong', `暗动：${dark}被日辰冲动，静极思动，暗中有变。`, '变数', 'A', [zsbyCitation('zsby.c27.1', '静爻旺相日辰冲之为暗动，静爻休囚日辰冲之为破，暗动者有喜有忌。')]));
    if (loose) rules.push(hit('liuyao.chongsan', `冲散：${loose}动而被日辰冲，恐有反复。`, '凶', 'D'));
  }
  // 三合
  const sh = sanHeJu(chart);
  for (const s of sh) {
    rules.push(hit('liuyao.sanhe', `三合局：${s.group.join('')}三合${s.middleMoving ? '成局' : '待成'}，主事聚众力而就。`, s.middleMoving ? '吉' : '变数', 'D'));
  }
  // 世应
  const sy = shiYingRelation(chart);
  if (sy.relation === '冲') rules.push(hit('liuyao.shiying.chong', '世应相冲，主测主与所测对象不合、事有阻隔。', '凶', 'D'));
  if (sy.relation === '合') rules.push(hit('liuyao.shiying.he', '世应相合，主测主与所测对象相合、事可和合。', '吉', 'D'));
  // 应期候选
  const timing: string[] = [];
  for (const l of xk) timing.push(`${l.liuqin}爻（${l.branch}）逢空，待出空/冲空之期（${DIZHI[(DIZHI.indexOf(l.branch) + 6) % 12]}日）`);
  for (const l of yp) timing.push(`${l.liuqin}爻（${l.branch}）月破，待${DIZHI[(DIZHI.indexOf(l.branch) + 6) % 12]}日补破`);
  for (const l of chart.lines.filter((x) => x.moving)) timing.push(`${l.liuqin}爻（${l.branch}）动，待逢值逢合之期（${l.branch}日/${ZHI_HE[l.branch]!}日）`);
  if (timing.length > 0) {
    rules.push(hit('liuyao.timing', `应期参考：${timing.join('；')}。`, '提示', 'A', [
      zsbyCitation('zsby.c34.1', '静而逢值逢冲：如主事爻临子水不动，后逢子日午日而应之，余仿此。'),
      zsbyCitation('zsby.c34.2', '动而逢合逢值：如主事爻临子水发动，后遇丑日子日而应之，余仿此。'),
    ]));
  } else {
    rules.push(hit('liuyao.timing.none', '卦象暂无显著应期线索，建议记录并事后回标实际时间以校准。', '提示', 'D'));
  }
  return rules;
}
