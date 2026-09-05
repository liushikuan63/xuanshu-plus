/**
 * ProviderRegistry（v5 §10.1）：模型名/区域/价格/能力持续变化，
 * 首次连接必须请求官方 model 清单探测，不得硬编码成销售承诺。
 */

export interface AIProvider {
  id: string;
  displayName: string;
  /** 可含 {workspaceId}/{region} 占位符，自定义时用用户 baseUrl */
  baseUrlTemplate: string;
  /** chat 补全路径（相对 baseUrl） */
  chatPath: string;
  authPrefix: string;
  docsUrl: string;
  retrievedAt: string;
  notes?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    baseUrlTemplate: 'https://api.deepseek.com',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: 'https://api-docs.deepseek.com/',
    retrievedAt: '2026-08-29',
    notes: 'OpenAI 兼容，支持 stream；模型名以官方清单为准',
  },
  {
    id: 'ark',
    displayName: '火山方舟 Doubao',
    baseUrlTemplate: 'https://ark.cn-beijing.volces.com/api/v3',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: 'https://www.volcengine.com/docs/82379',
    retrievedAt: '2026-08-29',
    notes: '兼容 OpenAI SDK；stream / JSON 需探测',
  },
  {
    id: 'zhipu',
    displayName: '智谱 GLM',
    baseUrlTemplate: 'https://open.bigmodel.cn/api/paas/v4',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
    retrievedAt: '2026-08-29',
    notes: 'JSON mode / 工具调用需探测',
  },
  {
    id: 'moonshot',
    displayName: 'Kimi / Moonshot',
    baseUrlTemplate: 'https://api.moonshot.cn/v1',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: 'https://platform.moonshot.cn/docs',
    retrievedAt: '2026-08-29',
    notes: '兼容 OpenAI，可用 OpenAI SDK；按模型测能力',
  },
  {
    id: 'hunyuan',
    displayName: '腾讯混元',
    baseUrlTemplate: 'https://api.hunyuan.cloud.tencent.com/v1',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: 'https://cloud.tencent.com/document/product/1729',
    retrievedAt: '2026-08-29',
    notes: 'OpenAI 兼容；官方说明逐步迁移，查实时模型/价格',
  },
  {
    id: 'qwen',
    displayName: '通义千问 DashScope',
    baseUrlTemplate: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: 'https://help.aliyun.com/zh/model-studio',
    retrievedAt: '2026-08-29',
    notes: '新版为 {WorkspaceId}.{region}.maas.aliyuncs.com/compatible-mode/v1；以官方定价页为准',
  },
  {
    id: 'custom',
    displayName: '自定义（OpenAI 兼容）',
    baseUrlTemplate: '',
    chatPath: '/chat/completions',
    authPrefix: 'Bearer',
    docsUrl: '',
    retrievedAt: '2026-08-29',
    notes: '兼容 Ollama / vLLM / 自建网关；发送前校验 URL scheme/路径',
  },
];

export function providerById(id: string): AIProvider {
  const p = AI_PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`未知 Provider: ${id}`);
  return p;
}

export interface AIConnectionConfig {
  providerId: string;
  baseUrl?: string; // 仅 custom 使用，内置厂商固定走官方入口
  apiKey: string;
  model: string;
  temperature?: number;
}

export function resolveBaseUrl(cfg: AIConnectionConfig): string {
  const p = providerById(cfg.providerId);
  const raw = p.id === 'custom' ? cfg.baseUrl?.trim() : p.baseUrlTemplate;
  if (!raw) throw new Error(`Provider ${p.id} 需要自定义 baseUrl`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('baseUrl 不是有效 URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('baseUrl 仅支持 http 或 https');
  if (url.username || url.password) throw new Error('baseUrl 不得包含用户名或密码');
  if (url.search || url.hash) throw new Error('baseUrl 不得包含查询参数或片段');
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path === '/' ? '' : path}`;
}

export function chatEndpoint(cfg: AIConnectionConfig): string {
  const p = providerById(cfg.providerId);
  return `${resolveBaseUrl(cfg)}${p.chatPath}`;
}

/** 测试连接：GET model 清单（各厂商能力探测入口，v5 §10.1） */
export async function testConnection(cfg: AIConnectionConfig, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; models: string[]; message?: string }> {
  try {
    const p = providerById(cfg.providerId);
    const url = `${resolveBaseUrl(cfg)}/models`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `${p.authPrefix} ${cfg.apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, models: [], message: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (data.data ?? []).map((m) => m.id ?? '').filter(Boolean);
    return { ok: true, models };
  } catch (e) {
    return { ok: false, models: [], message: (e as Error).message };
  }
}
