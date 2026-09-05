/**
 * 联网资料检索（可选增强，键与 AI 设置同源安全存储）
 * 说明：浏览器直连第三方搜索 API 常受 CORS 限制；桌面端（Electron）应经主进程代理。
 * 结果仅作「联网资料」，一律标注需人工核实，不进入排盘层证据（不参与 CitationRef 权威链）。
 */

export interface WebSearchConfig {
  /** bing = 必应搜索 Web Search API v7；serper = Serper.dev Google 搜索 JSON API */
  providerId: 'bing' | 'serper';
  apiKey: string;
  count?: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function bingQuery(key: string, q: string, count: number): Promise<WebSearchResult[]> {
  return fetch(`https://api.cognitive.microsoft.com/bing/v7.0/search?q=${encodeURIComponent(q)}&count=${Math.min(count, 10)}`, {
    headers: { 'Ocp-Apim-Subscription-Key': key },
    signal: AbortSignal.timeout(15000),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`必应搜索失败：HTTP ${res.status}`);
      const data = (await res.json()) as { webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> } };
      return (data.webPages?.value ?? []).map((x) => ({ title: x.name ?? '', url: x.url ?? '', snippet: x.snippet ?? '' }));
    });
}

function serperQuery(key: string, q: string, count: number): Promise<WebSearchResult[]> {
  return fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, num: Math.min(count, 10) }),
    signal: AbortSignal.timeout(15000),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Serper 搜索失败：HTTP ${res.status}`);
      const data = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
      return (data.organic ?? []).map((x) => ({ title: x.title ?? '', url: x.link ?? '', snippet: x.snippet ?? '' }));
    });
}

/** 联网检索（CORS 受限时抛错，桌面端建议走主进程代理） */
export async function webSearch(query: string, cfg: WebSearchConfig): Promise<WebSearchResult[]> {
  const q = query.trim();
  if (!q) throw new Error('请输入检索词');
  if (!cfg.apiKey.trim()) throw new Error('请输入检索 API Key');
  const count = Math.max(1, Math.min(10, Math.trunc(cfg.count ?? 5)));
  const raw = cfg.providerId === 'bing' ? await bingQuery(cfg.apiKey, q, count) : await serperQuery(cfg.apiKey, q, count);
  return raw.map((x) => ({ title: String(x.title).slice(0, 120), url: String(x.url), snippet: String(x.snippet).slice(0, 240) }));
}

/** 摘要拼装（供 AI 提示或展示） */
export function summarizeSearchResults(results: WebSearchResult[]): string {
  return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
}
