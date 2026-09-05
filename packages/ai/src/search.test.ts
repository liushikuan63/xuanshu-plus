import { afterEach, describe, expect, it, vi } from 'vitest';
import { webSearch, summarizeSearchResults } from './search.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('联网检索', () => {
  it('bing：解析 webPages -> 结果数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ webPages: { value: [{ name: '标题A', url: 'https://a', snippet: '摘要A' }] } }),
    })));
    const r = await webSearch('测试', { providerId: 'bing', apiKey: 'k' });
    expect(r).toEqual([{ title: '标题A', url: 'https://a', snippet: '摘要A' }]);
  });

  it('serper：解析 organic -> 结果数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ organic: [{ title: '标题B', link: 'https://b', snippet: '摘要B' }] }),
    })));
    const r = await webSearch('测', { providerId: 'serper', apiKey: 'k', count: 3 });
    expect(r[0]!.url).toBe('https://b');
  });

  it('HTTP 错误 / CORS 错误原样抛出（UI 据 message 提示）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    await expect(webSearch('x', { providerId: 'bing', apiKey: 'bad' })).rejects.toThrow('HTTP 401');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(webSearch('x', { providerId: 'serper', apiKey: 'k' })).rejects.toThrow('Failed to fetch');
  });

  it('空检索词拒绝', async () => {
    await expect(webSearch('   ', { providerId: 'bing', apiKey: 'k' })).rejects.toThrow('请输入检索词');
  });

  it('空 API Key 拒绝', async () => {
    await expect(webSearch('测试', { providerId: 'bing', apiKey: '   ' })).rejects.toThrow('请输入检索 API Key');
  });

  it('摘要拼装可读', () => {
    const s = summarizeSearchResults([{ title: 'T', url: 'https://u', snippet: 'S' }]);
    expect(s).toContain('[1] T');
    expect(s).toContain('https://u');
  });
});
