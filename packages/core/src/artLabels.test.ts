import { describe, expect, it } from 'vitest';
import { ART_TYPES } from './types.js';
import { ART_LABELS, artLabel } from './artLabels.js';

describe('术数中文名称', () => {
  it('覆盖全部公开术数标识', () => {
    expect(Object.keys(ART_LABELS)).toEqual(expect.arrayContaining(ART_TYPES));
    for (const art of ART_TYPES) expect(artLabel(art)).not.toBe(art);
  });

  it('未知标识原样回退', () => {
    expect(artLabel('custom-art')).toBe('custom-art');
  });
});
