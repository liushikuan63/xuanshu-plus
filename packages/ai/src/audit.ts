/**
 * 调用审计日志（v5 §10.4）：不含完整输入输出（需用户主动开启调试日志）
 */

export interface AuditEntry {
  time: string;
  providerId: string;
  model: string;
  inputHash: string;
  outputHash: string;
  latencyMs: number;
  tokens?: { prompt: number; completion: number };
  schemaVersion: number;
}

export function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function makeAuditEntry(partial: Omit<AuditEntry, 'time' | 'schemaVersion'>): AuditEntry {
  return { time: new Date().toISOString(), schemaVersion: 1, ...partial };
}
