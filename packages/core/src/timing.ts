/** 带公历日期的应期观察窗口，只依据盘面已经计算出的干支关系。 */
import { jdToDate } from './astronomy/jde.js';
import { DIZHI, TIANGAN, ZHI_LIUHE, dayGanZhiFromJdn, zhiChong, type Gan, type Zhi } from './calendar/ganzhi.js';
import type { LiuyaoChart } from './arts/liuyao/engine.js';
import type { QimenChart } from './arts/qimen/engine.js';
import type { ArtType } from './types.js';

export interface TimelineEntry {
  date: string;
  ganzhi: string;
  offsetDays: number;
  label: string;
  tone: 'ji' | 'xiong' | 'neutral';
  basis: string[];
  plain: string;
  ruleId: string;
}

export interface Timeline {
  art: ArtType;
  title: string;
  from: string;
  fromGanzhi: string;
  horizonDays: number;
  entries: TimelineEntry[];
  method: string;
  caveats: string[];
}

interface DayInfo {
  date: string;
  ganzhi: string;
  stem: Gan;
  branch: Zhi;
  offsetDays: number;
}

const CAVEATS = [
  '这些日期是根据值日、六合和冲空关系推得的观察窗口，不代表事件必然发生。',
  '窗口用于安排事实核对；医疗、法律、投资等事项仍应以专业意见和现实证据为准。',
];

function daysFrom(startJdn: number, count: number): DayInfo[] {
  return Array.from({ length: count }, (_, offsetDays) => {
    const jdn = startJdn + offsetDays;
    const date = jdToDate(jdn - 0.5);
    const ganzhi = dayGanZhiFromJdn(jdn);
    return {
      date: `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`,
      ganzhi: `${ganzhi.gan}${ganzhi.zhi}`,
      stem: ganzhi.gan,
      branch: ganzhi.zhi,
      offsetDays,
    };
  });
}

function matchingDays(days: DayInfo[], branch: Zhi, relation: 'value' | 'combine' | 'clash'): DayInfo[] {
  const target = relation === 'value' ? branch : relation === 'combine' ? ZHI_LIUHE[branch] : zhiChong(branch);
  return days.filter((day) => day.offsetDays > 0 && day.branch === target);
}

function dedupe(entries: TimelineEntry[]): TimelineEntry[] {
  const found = new Map<string, TimelineEntry>();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.ruleId}|${entry.label}`;
    if (!found.has(key)) found.set(key, entry);
  }
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date) || a.ruleId.localeCompare(b.ruleId));
}

function liuyaoTimeline(chart: LiuyaoChart, horizonDays: number): Timeline {
  const days = daysFrom(chart.normalized.jdn, horizonDays + 1);
  const entries: TimelineEntry[] = [];

  for (const line of chart.lines.filter((item) => item.moving)) {
    for (const day of matchingDays(days, line.branch, 'value')) {
      entries.push({
        date: day.date,
        ganzhi: day.ganzhi,
        offsetDays: day.offsetDays,
        label: `${day.ganzhi}日 · 动爻${line.branch}值日`,
        tone: 'neutral',
        basis: [`第${line.index + 1}爻发动`, `动爻地支为${line.branch}`, `${line.branch}再次值日`],
        plain: `第${line.index + 1}爻所主的变化在${day.date}再次获得时间信号，适合核对是否出现实际进展。`,
        ruleId: 'liuyao.timeline.moving-value',
      });
    }
  }

  const ying = chart.lines.find((line) => line.isYing);
  if (ying) {
    for (const day of matchingDays(days, ying.branch, 'value')) {
      entries.push({
        date: day.date,
        ganzhi: day.ganzhi,
        offsetDays: day.offsetDays,
        label: `${day.ganzhi}日 · 应爻${ying.branch}值日`,
        tone: 'neutral',
        basis: [`应爻在第${ying.index + 1}爻`, `应爻地支为${ying.branch}`],
        plain: `需要对方或外部条件配合的事项，可在${day.date}主动确认答复。`,
        ruleId: 'liuyao.timeline.ying-value',
      });
    }
  }

  for (const branch of chart.xunKong as Zhi[]) {
    for (const day of matchingDays(days, branch, 'clash')) {
      entries.push({
        date: day.date,
        ganzhi: day.ganzhi,
        offsetDays: day.offsetDays,
        label: `${day.ganzhi}日 · 冲${branch}填空`,
        tone: 'neutral',
        basis: [`本卦旬空${chart.xunKong.join('')}`, `${day.branch}日冲${branch}`],
        plain: `原本落空的条件在${day.date}适合被证实或证伪，不宜在核实前追加投入。`,
        ruleId: 'liuyao.timeline.kongwang-fill',
      });
    }
  }

  return {
    art: 'liuyao',
    title: '六爻应期时间轴',
    from: days[0]!.date,
    fromGanzhi: days[0]!.ganzhi,
    horizonDays,
    entries: dedupe(entries),
    method: '从占时顺推，列出动爻值日、应爻值日与旬空逢冲三类可复核关系。',
    caveats: [...CAVEATS, '未指定取用神时不生成“用神值日”，避免替用户猜测事项口径。'],
  };
}

const PALACE_BRANCH: Partial<Record<number, Zhi>> = {
  1: '子', 2: '未', 3: '卯', 4: '巳', 6: '戌', 7: '酉', 8: '丑', 9: '午',
};

function qimenTimeline(chart: QimenChart, horizonDays: number): Timeline {
  const days = daysFrom(chart.normalized.jdn, horizonDays + 1);
  const entries: TimelineEntry[] = [];
  const palaceBranch = PALACE_BRANCH[chart.hourGanPalace];
  if (palaceBranch) {
    for (const [relation, label, tone] of [['value', '值日', 'ji'], ['combine', '逢合', 'ji']] as const) {
      for (const day of matchingDays(days, palaceBranch, relation)) {
        entries.push({
          date: day.date,
          ganzhi: day.ganzhi,
          offsetDays: day.offsetDays,
          label: `${day.ganzhi}日 · 时干宫${palaceBranch}${label}`,
          tone,
          basis: [`时干${chart.hourGan}落${chart.hourGanPalace}宫`, `宫支取${palaceBranch}`, relation === 'value' ? '宫支再次值日' : `日支${day.branch}与宫支六合`],
          plain: `${day.date}适合围绕时干所代表的事体做一次有明确结果的推进或核对。`,
          ruleId: `qimen.timeline.hour-palace-${relation}`,
        });
      }
    }
  }

  for (const branch of [...chart.xunKong] as Zhi[]) {
    for (const day of matchingDays(days, branch, 'clash')) {
      entries.push({
        date: day.date,
        ganzhi: day.ganzhi,
        offsetDays: day.offsetDays,
        label: `${day.ganzhi}日 · 冲${branch}填空`,
        tone: 'neutral',
        basis: [`本局旬空${chart.xunKong}`, `${day.branch}日冲${branch}`],
        plain: `${day.date}适合核实原本悬而未决的条件是否真正落地。`,
        ruleId: 'qimen.timeline.kongwang-fill',
      });
    }
  }

  for (const day of days.filter((item) => item.offsetDays > 0 && ['乙', '丙', '丁'].includes(item.stem))) {
    entries.push({
      date: day.date,
      ganzhi: day.ganzhi,
      offsetDays: day.offsetDays,
      label: `${day.ganzhi}日 · 三奇临日`,
      tone: 'ji',
      basis: [`日干${day.stem}属于三奇乙丙丁`, `${chart.yangDun ? '阳' : '阴'}遁${chart.ju}局`],
      plain: `${day.date}可优先安排文书、沟通、请托等需要转圜的事项。`,
      ruleId: 'qimen.timeline.sanqi-day',
    });
  }

  return {
    art: 'qimen',
    title: '奇门应期时间轴',
    from: days[0]!.date,
    fromGanzhi: days[0]!.ganzhi,
    horizonDays,
    entries: dedupe(entries),
    method: '从占时顺推，列出时干落宫值日/逢合、旬空逢冲与三奇临日。四隅宫按通行首支取值。',
    caveats: [...CAVEATS, '九宫中宫没有固定地支；时干落中五时不生成宫支窗口。'],
  };
}

/** 当前仅对关系足够明确的六爻与奇门生成日期，其他术数继续显示原有文字应期。 */
export function timelineForChart(art: ArtType, chart: unknown, horizonDays = 45): Timeline | null {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 366) {
    throw new RangeError('应期时间轴范围必须为 1 至 366 天');
  }
  if (art === 'liuyao') return liuyaoTimeline(chart as LiuyaoChart, horizonDays);
  if (art === 'qimen') return qimenTimeline(chart as QimenChart, horizonDays);
  return null;
}

export { CAVEATS as TIMELINE_CAVEATS, DIZHI as TIMELINE_BRANCHES, TIANGAN as TIMELINE_STEMS };
