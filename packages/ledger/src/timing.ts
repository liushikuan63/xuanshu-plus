/** 应期观察窗口：独立于案例结果保存，反馈永不回写排盘。 */
import type { ArtType, TimelineEntry } from '@xuanshu/core';
import { browserStorage, type KeyValueStorage } from './localstore.js';

export type WindowVerdict = '待观察' | '应验' | '部分应验' | '未应验' | '无法判断';

export interface WindowFollowup {
  key: string;
  caseId: string;
  artType: ArtType;
  category: string;
  date: string;
  ruleId: string;
  tone: TimelineEntry['tone'];
  label: string;
  verdict: WindowVerdict;
  actualDate?: string;
  note?: string;
  recordedAt: string;
  judgedAt?: string;
}

export interface WindowRuleStat {
  due: number;
  judged: number;
  hit: number;
  early: number;
  dated: number;
  inTolerance: number;
  offsets: number[];
  medianOffset: number | null;
  medianAbs: number | null;
}

export const FOLLOWUPS_KEY = 'xuanshu.followups.v1';

function dayDiff(expected: string, actual: string): number {
  const a = Date.parse(`${expected}T00:00:00Z`);
  const b = Date.parse(`${actual}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : Number.NaN;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[middle]! : Math.round((values[middle - 1]! + values[middle]!) / 2);
}

function blankStat(): WindowRuleStat {
  return { due: 0, judged: 0, hit: 0, early: 0, dated: 0, inTolerance: 0, offsets: [], medianOffset: null, medianAbs: null };
}

/** 未判定窗口不进入命中率分母；提前判定单列，避免虚高。 */
export function aggregateWindowStats(
  rows: WindowFollowup[],
  today: string,
  minSample = 10,
  toleranceDays = 3,
): { byRule: Record<string, WindowRuleStat>; insufficient: string[] } {
  const byRule: Record<string, WindowRuleStat> = {};
  for (const row of rows) {
    const due = row.date <= today;
    const settled = row.verdict === '应验' || row.verdict === '部分应验' || row.verdict === '未应验';
    let stat: WindowRuleStat | undefined;
    if (due) {
      stat = (byRule[row.ruleId] ??= blankStat());
      stat.due += 1;
      if (settled) {
        stat.judged += 1;
        if (row.verdict !== '未应验') stat.hit += 1;
      }
    } else if (settled) {
      stat = (byRule[row.ruleId] ??= blankStat());
      stat.early += 1;
    }
    if (row.actualDate) {
      const offset = dayDiff(row.date, row.actualDate);
      if (Number.isFinite(offset)) {
        stat = (byRule[row.ruleId] ??= blankStat());
        stat.dated += 1;
        stat.offsets.push(offset);
        if (Math.abs(offset) <= toleranceDays) stat.inTolerance += 1;
      }
    }
  }
  for (const stat of Object.values(byRule)) {
    stat.offsets.sort((a, b) => a - b);
    if (stat.dated >= minSample) {
      stat.medianOffset = median(stat.offsets);
      stat.medianAbs = median(stat.offsets.map(Math.abs).sort((a, b) => a - b));
    }
  }
  return {
    byRule,
    insufficient: Object.entries(byRule).filter(([, stat]) => stat.judged < minSample).map(([ruleId]) => ruleId),
  };
}

function isFollowup(value: unknown): value is WindowFollowup {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.key === 'string'
    && typeof row.caseId === 'string'
    && typeof row.artType === 'string'
    && typeof row.category === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date))
    && typeof row.ruleId === 'string'
    && typeof row.label === 'string'
    && ['待观察', '应验', '部分应验', '未应验', '无法判断'].includes(String(row.verdict));
}

export class LocalFollowupStore {
  private rows = new Map<string, WindowFollowup>();

  constructor(private readonly storage: KeyValueStorage = browserStorage()) {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(FOLLOWUPS_KEY) ?? '[]');
      if (Array.isArray(parsed)) {
        for (const row of parsed) if (isFollowup(row)) this.rows.set(row.key, row);
      }
    } catch {
      this.rows.clear();
    }
  }

  private commit(next: Map<string, WindowFollowup>): void {
    try {
      this.storage.setItem(FOLLOWUPS_KEY, JSON.stringify([...next.values()]));
      this.rows = next;
    } catch (error) {
      throw new Error('应期回收持久化失败，可能是浏览器存储配额不足或存储已被禁用', { cause: error });
    }
  }

  async seed(caseId: string, artType: ArtType, category: string, entries: TimelineEntry[]): Promise<number> {
    const next = new Map(this.rows);
    let added = 0;
    const now = new Date().toISOString();
    for (const entry of entries) {
      const key = `${caseId}|${entry.date}|${entry.ruleId}`;
      if (next.has(key)) continue;
      next.set(key, {
        key, caseId, artType, category, date: entry.date, ruleId: entry.ruleId,
        tone: entry.tone, label: entry.label, verdict: '待观察', recordedAt: now,
      });
      added += 1;
    }
    if (added > 0) this.commit(next);
    return added;
  }

  async list(caseId?: string): Promise<WindowFollowup[]> {
    const rows = [...this.rows.values()];
    return rows.filter((row) => !caseId || row.caseId === caseId).sort((a, b) => a.date.localeCompare(b.date));
  }

  async setVerdict(key: string, verdict: WindowVerdict, extra: { actualDate?: string; note?: string } = {}): Promise<void> {
    const current = this.rows.get(key);
    if (!current) throw new Error('应期观察窗口不存在');
    const next = new Map(this.rows);
    const settled = verdict === '应验' || verdict === '部分应验' || verdict === '未应验';
    next.set(key, {
      ...current,
      verdict,
      actualDate: extra.actualDate ?? current.actualDate,
      note: extra.note ?? current.note,
      recordedAt: new Date().toISOString(),
      judgedAt: settled ? new Date().toISOString().slice(0, 10) : current.judgedAt,
    });
    this.commit(next);
  }

  async stats(today = new Date().toISOString().slice(0, 10), minSample = 10): Promise<ReturnType<typeof aggregateWindowStats>> {
    return aggregateWindowStats(await this.list(), today, minSample);
  }
}
