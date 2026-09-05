/**
 * 导出：.xuan-case.json / CSV / Markdown（含盘面、证据、标注、出处）
 */

import type { CaseRecord } from './schema.js';
import { artLabel } from '@xuanshu/core';

export interface ExportMeta {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  checksum: string;
}

function checksumOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'sha1-like_' + h.toString(16).padStart(8, '0');
}

export function exportJson(records: CaseRecord[], appVersion = '0.1.0'): string {
  const body = JSON.stringify(records, null, 2);
  const meta: ExportMeta = { schemaVersion: 1, exportedAt: new Date().toISOString(), appVersion, checksum: checksumOf(body) };
  return JSON.stringify({ meta, records: JSON.parse(body) }, null, 2);
}

export interface CaseImportResult {
  records: CaseRecord[];
  invalidCount: number;
  checksumVerified: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** 对外部导入数据做运行时校验，避免损坏记录进入存储后在列表/统计阶段崩溃。 */
export function isCaseRecord(value: unknown): value is CaseRecord {
  if (!isObject(value) || !isObject(value.question) || !isObject(value.input) || !isObject(value.result) || !isObject(value.annotation)) return false;
  const artTypes = new Set(['bazi', 'liuyao', 'meihua', 'qimen', 'liuren', 'xiaoliuren', 'jinkou', 'ziwei']);
  const statuses = new Set(['open', 'resolved', 'archived']);
  const outcomes = new Set(['应验', '部分应验', '未应验', '无法判断']);
  const annotation = value.annotation;
  const outcome = annotation.outcome;
  if (outcome !== undefined && (!isObject(outcome) || !outcomes.has(String(outcome.result)) || typeof outcome.at !== 'string')) return false;
  const ruleHits = value.result.ruleHits;
  if (!Array.isArray(ruleHits) || !ruleHits.every((hit) => {
    if (!isObject(hit) || typeof hit.ruleId !== 'string' || typeof hit.text !== 'string' || typeof hit.confidenceLevel !== 'string') return false;
    if (hit.citations === undefined) return true;
    return Array.isArray(hit.citations) && hit.citations.every((citation) =>
      isObject(citation)
      && typeof citation.canonicalId === 'string'
      && typeof citation.book === 'string'
      && typeof citation.chapter === 'string'
      && typeof citation.segId === 'string'
      && typeof citation.quote === 'string',
    );
  })) return false;
  return typeof value.caseId === 'string'
    && value.caseId.length > 0
    && typeof value.artType === 'string'
    && artTypes.has(value.artType)
    && typeof value.createdAt === 'string'
    && typeof value.schemaVersion === 'number'
    && typeof value.question.category === 'string'
    && typeof value.question.summary === 'string'
    && isObject(value.question.structured)
    && isObject(value.input.raw)
    && isObject(value.input.normalized)
    && isObject(value.input.config)
    && typeof value.input.configHash === 'string'
    && typeof value.input.engineVersion === 'string'
    && isObject(value.result.chart)
    && Array.isArray(value.result.warnings)
    && Array.isArray(value.result.evidenceRefs)
    && typeof value.result.boardHash === 'string'
    && isStringArray(annotation.presetTags)
    && isStringArray(annotation.customTags)
    && typeof annotation.updatedAt === 'string'
    && typeof value.status === 'string'
    && statuses.has(value.status)
    && isStringArray(value.linkedCaseIds)
    && isStringArray(value.tags)
    && typeof value.revision === 'number';
}

/** 支持当前导出信封和早期裸数组格式；有 checksum 时必须通过完整性校验。 */
export function parseCaseImport(text: string): CaseImportResult {
  const parsed: unknown = JSON.parse(text);
  const envelope = isObject(parsed) ? parsed : undefined;
  const rawRecords = Array.isArray(parsed) ? parsed : envelope?.records;
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) throw new Error('文件不含案例记录');

  const meta = envelope && isObject(envelope.meta) ? envelope.meta : undefined;
  const checksum = meta?.checksum;
  let checksumVerified = false;
  if (checksum !== undefined) {
    if (typeof checksum !== 'string' || checksum !== checksumOf(JSON.stringify(rawRecords, null, 2))) {
      throw new Error('案例文件 checksum 校验失败，文件可能已损坏或被修改');
    }
    checksumVerified = true;
  }

  const records = rawRecords.filter(isCaseRecord);
  if (records.length === 0) throw new Error('文件中的案例记录结构无效');
  return { records, invalidCount: rawRecords.length - records.length, checksumVerified };
}

/** 同 caseId 冲突时优先 revision，revision 相同再比较最后标注时间。 */
export function isIncomingCaseNewer(incoming: CaseRecord, existing: CaseRecord): boolean {
  if (incoming.revision !== existing.revision) return incoming.revision > existing.revision;
  const incomingTime = Date.parse(incoming.annotation.updatedAt || incoming.createdAt);
  const existingTime = Date.parse(existing.annotation.updatedAt || existing.createdAt);
  return (Number.isFinite(incomingTime) ? incomingTime : 0) > (Number.isFinite(existingTime) ? existingTime : 0);
}

export function exportCsv(records: CaseRecord[]): string {
  const header = ['caseId', 'artType', 'category', 'summary', 'createdAt', 'status', 'result', 'note', 'keyTakeaway'];
  const rows = records.map((r) => [
    r.caseId,
    r.artType,
    r.question.category,
    r.question.summary,
    r.createdAt,
    r.status,
    r.annotation.outcome?.result ?? '',
    r.annotation.note ?? '',
    r.annotation.keyTakeaway ?? '',
  ]);
  return [header.join(','), ...rows.map((row) => row.map(csv).join(','))].join('\n');
}

export function exportMarkdown(records: CaseRecord[], opts: { withTextFragment?: boolean } = {}): string {
  const parts: string[] = ['# 玄枢案例本导出', ''];
  for (const r of records) {
    parts.push(`## ${r.question.summary}`, '');
    parts.push(`- 术数：${artLabel(r.artType)}`);
    parts.push(`- 事项：${r.question.category}${r.question.subCategory ? ` / ${r.question.subCategory}` : ''}`);
    parts.push(`- 时间：${r.createdAt}`);
    parts.push(`- 状态：${r.status}`);
    parts.push('');
    parts.push('### 断语与出处', '');
    for (const h of r.result.ruleHits) {
      let line = `- ${h.text} \`${h.ruleId}\``;
      if (h.citations && h.citations.length > 0) {
        const cites = h.citations
          .map((c) => `《${c.book}》${c.chapter}${opts.withTextFragment && c.sourceUrl ? ` ([${c.segId}](${c.sourceUrl}#:~:text=${encodeURIComponent(c.quote.slice(0, 40))}))` : ''}`)
          .join('；');
        line += ` 〔出处：${cites}〕`;
      }
      parts.push(line);
    }
    if (r.annotation.outcome) {
      parts.push('', '### 事后回标', '', `- 结果：${r.annotation.outcome.result}`);
      if (r.annotation.outcome.at) parts.push(`- 时间：${r.annotation.outcome.at}`);
      if (r.annotation.note) parts.push(`- 备注：${r.annotation.note}`);
    }
    parts.push('');
  }
  return parts.join('\n');
}

function csv(s: string): string {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
