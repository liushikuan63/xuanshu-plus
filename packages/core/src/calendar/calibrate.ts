/**
 * 校准与分歧台账（v5 §4.2）：
 *  - 节气瞬时差 > 2 分钟 → 标 degraded，不硬抛错
 *  - 每个分歧进分歧台账：divergence_id + 复现输入 + 各系统输出 + 处置
 */

export type Disposition = 'accepted' | 'pending-source' | 'frozen-default';

export interface DivergenceEntry {
  divergenceId: string;
  kind: 'solar-term' | 'ganzhi' | 'lunar' | 'true-solar-time';
  inputs: Record<string, unknown>;
  systems: Record<string, unknown>;
  disposition: Disposition;
  note?: string;
  createdAt: string;
}

let divergenceSeq = 0;

export function createDivergence(
  kind: DivergenceEntry['kind'],
  inputs: Record<string, unknown>,
  systems: Record<string, unknown>,
  disposition: Disposition,
  note?: string,
): DivergenceEntry {
  divergenceSeq += 1;
  return {
    divergenceId: `div-${Date.now().toString(36)}-${divergenceSeq}`,
    kind,
    inputs,
    systems,
    disposition,
    note,
    createdAt: new Date().toISOString(),
  };
}

export interface TermCalibrationResult {
  jde: number;
  /** 与参考值之差（分钟）。正 = 本引擎偏晚 */
  diffMinutes: number;
  confidence: 'ok' | 'degraded';
  divergence?: DivergenceEntry;
}

/**
 * 节气校准：与参考 JDE 比对。
 * ≤2 分钟 → ok；>2 分钟 → degraded + 分歧台账（不抛错）。
 */
export function calibrateTerm(
  termName: string,
  ownJde: number,
  referenceJde: number,
  referenceLabel: string,
): TermCalibrationResult {
  const diffMinutes = ((ownJde - referenceJde) * 24 * 60);
  const abs = Math.abs(diffMinutes);
  if (abs <= 2) {
    return { jde: ownJde, diffMinutes, confidence: 'ok' };
  }
  const divergence = createDivergence(
    'solar-term',
    { term: termName, ownJde, referenceJde },
    { reference: referenceLabel, diffMinutes: Math.round(diffMinutes * 100) / 100 },
    'accepted',
    '节气瞬时差超过 2 分钟：标 degraded，优先采用外部库值',
  );
  return { jde: ownJde, diffMinutes, confidence: 'degraded', divergence };
}
