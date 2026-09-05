/**
 * L1 段内 charRange 定位（v5 §9.2 主机制）：
 * 按 segId 定位段 → 按 charRange 高亮；校验失败降级「高亮整段」。
 */

import type { CitationRef } from '@xuanshu/core';

export interface Segment {
  segId: string;
  text: string;
}

export interface LocateResult {
  segId: string;
  charRange?: [number, number];
  highlight: 'range' | 'whole';
  note?: string;
}

export function locate(citation: CitationRef, segments: Segment[]): LocateResult {
  const seg = segments.find((s) => s.segId === citation.segId);
  if (!seg) {
    throw new Error(`段不存在: ${citation.segId}`);
  }
  if (!citation.charRange) {
    return { segId: citation.segId, highlight: 'whole', note: '无 charRange，高亮整段' };
  }
  const [start, end] = citation.charRange;
  if (start < 0 || end > seg.text.length || start >= end) {
    return { segId: citation.segId, highlight: 'whole', note: 'charRange 越界（文本可能有微调），降级高亮整段' };
  }
  return { segId: citation.segId, charRange: [start, end], highlight: 'range' };
}

/** L2 Text Fragments（仅对外分享，v5 §9.2） */
export function textFragmentUrl(sourceUrl: string, quote: string): string {
  const q = quote.trim().slice(0, 60);
  return `${sourceUrl}#:~:text=${encodeURIComponent(q)}`;
}

/** L3 IIIF Canvas（预留，P6 影印本） */
export function iiifCanvasUrl(canvasUrl: string, x: number, y: number, w: number, h: number): string {
  return `${canvasUrl}#xywh=${x},${y},${w},${h}`;
}

/** 深链协议：xuanshu://read/{canonicalId}?seg={segId}&hl={start}-{end}&from={caseId|ruleId} */
export function deepLink(citation: CitationRef, from?: string): string {
  const hl = citation.charRange ? `&hl=${citation.charRange[0]}-${citation.charRange[1]}` : '';
  const f = from ? `&from=${encodeURIComponent(from)}` : '';
  return `xuanshu://read/${citation.canonicalId}?seg=${citation.segId}${hl}${f}`;
}
