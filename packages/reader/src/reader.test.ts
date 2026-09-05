import { describe, expect, it } from 'vitest';
import { validateCitation, verifyCharRange } from './citation.js';
import { locate, deepLink, textFragmentUrl } from './locate.js';
import { Bookshelf } from './catalog.js';
import type { CitationRef } from '@xuanshu/core';

const good: CitationRef = {
  canonicalId: 'zengshanbuyi.ws.1912',
  book: '增删卜易',
  edition: '民国三年校经山房石印本',
  chapter: '卷三·失物章',
  segId: 'zsby.3.12',
  charRange: [0, 10],
  quote: '用神宜旺，不宜空破',
  license: '公有领域',
  confidenceLevel: 'A',
};

describe('引用校验', () => {
  it('完整引用通过', () => {
    const r = validateCitation(good);
    expect(r.ok).toBe(true);
  });

  it('缺字段报错', () => {
    const r = validateCitation({ ...good, segId: '' });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes('segId'))).toBe(true);
  });

  it('pending segId 标记降级', () => {
    const r = validateCitation({ ...good, segId: 'pending:zengshanbuyi:失物章' });
    expect(r.degraded).toBe(true);
  });

  it('charRange 越界降级为整段高亮', () => {
    const r = verifyCharRange({ ...good, charRange: [0, 100] }, '用神宜旺，不宜空破。');
    expect(r.ok).toBe(false);
  });
});

describe('L1 定位', () => {
  const segments = [{ segId: 'zsby.3.12', text: '用神宜旺，不宜空破。纵暂时不见，终能找回。' }];

  it('按 charRange 高亮', () => {
    const r = locate({ ...good, charRange: [0, 4] }, segments);
    expect(r.highlight).toBe('range');
    expect(r.charRange).toEqual([0, 4]);
  });

  it('越界降级整段', () => {
    const r = locate({ ...good, charRange: [0, 999] }, segments);
    expect(r.highlight).toBe('whole');
  });

  it('深链协议', () => {
    const link = deepLink(good, 'case_abc');
    expect(link).toContain('xuanshu://read/');
    expect(link).toContain('from=case_abc');
  });

  it('Text Fragment 仅用于分享', () => {
    const url = textFragmentUrl('https://zh.wikisource.org/wiki/xxx', '用神宜旺');
    expect(url).toContain('#:~:text=');
  });
});

describe('书架目录', () => {
  it('目录树定位段', () => {
    const shelf = new Bookshelf();
    shelf.add({
      canonicalId: 'zengshanbuyi',
      title: '增删卜易',
      edition: '公有领域',
      license: '公有领域',
      status: 'builtin',
      toc: [{ volume: '卷三', chapter: '失物章', segIds: ['zsby.3.12'] }],
    });
    const r = shelf.locateSeg('zengshanbuyi', 'zsby.3.12');
    expect(r.node?.chapter).toBe('失物章');
    expect(shelf.get('zengshanbuyi')?.title).toBe('增删卜易');
  });
});
