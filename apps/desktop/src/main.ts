/**
 * 玄枢桌面端主进程（v8 §2.8 / §10.4）
 *  - Win11 窗口：Mica 背景、保留原生标题栏（Snap Layouts）、系统主题
 *  - 安全：contextIsolation + sandbox + CSP；Key 不落渲染进程
 *  - 密钥链路：safeStorage（Windows=DPAPI）加密存储 AI Key 于 %APPDATA%/xuanshu/keys.json
 *  - AI 代理：渲染进程经 IPC 请求，主进程持 Key 发请求（Key 不进 localStorage）
 */

import { app, BrowserWindow, ipcMain, nativeTheme, safeStorage, shell, type IpcMainInvokeEvent } from 'electron';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const isDev = !!process.env.XUANSHU_DEV;
const dataDir = join(app.getPath('userData'));
const keysFile = join(dataDir, 'keys.json');
let trustedRendererUrl = '';
mkdirSync(dataDir, { recursive: true });

/** 渲染进程 → 主进程的密钥/代理操作（一次调用即返回，Key 明文仅在主进程短留） */
interface AiProxyRequest {
  providerId: string;
  baseUrl?: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  responseJson?: boolean;
  maxTokens?: number;
  testOnly?: boolean;
}

function loadKeys(): Record<string, string> {
  try {
    if (!existsSync(keysFile)) return {};
    const raw = JSON.parse(readFileSync(keysFile, 'utf-8')) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      try {
        out[k] = safeStorage.decryptString(Buffer.from(v, 'base64'));
      } catch {
        /* 单条损坏跳过 */
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveKeys(keys: Record<string, string>): void {
  const enc: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) enc[k] = safeStorage.encryptString(v).toString('base64');
  writeFileSync(keysFile, JSON.stringify(enc), 'utf-8');
}

const keys = loadKeys();

/** OpenAI 兼容 chat 请求（主进程代理；Key 取自 safeStorage 存储） */
async function proxyChat(req: AiProxyRequest): Promise<{ ok: boolean; content?: string; error?: string; models?: string[] }> {
  try {
    if (!req || typeof req !== 'object') return { ok: false, error: 'AI 请求结构无效' };
    const p = providerById(req.providerId);
    const key = keys[req.providerId];
    if (!key) return { ok: false, error: '未在桌面安全存储中找到该厂商的 API Key' };
    const baseUrl = resolveBaseUrl(req.providerId, req.baseUrl);
    if (req.testOnly) {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `${p.authPrefix} ${key}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      const models = (data.data ?? []).map((m) => m.id ?? '').filter(Boolean);
      return { ok: true, models };
    }
    if (typeof req.model !== 'string' || !req.model.trim()) return { ok: false, error: '模型名不能为空' };
    if (!Array.isArray(req.messages) || !req.messages.every((message) =>
      message
      && typeof message.role === 'string'
      && typeof message.content === 'string'
      && message.content.length <= 200_000,
    )) return { ok: false, error: 'messages 结构无效或内容过长' };
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      stream: false,
    };
    if (req.maxTokens) body.max_tokens = req.maxTokens;
    if (req.responseJson) body.response_format = { type: 'json_object' };
    const res = await fetch(`${baseUrl}${p.chatPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `${p.authPrefix} ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'AI 响应缺少 choices[0].message.content' };
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function providerById(id: string): { baseUrlTemplate: string; chatPath: string; authPrefix: string } {
  const map: Record<string, { baseUrlTemplate: string; chatPath: string; authPrefix: string }> = {
    deepseek: { baseUrlTemplate: 'https://api.deepseek.com', chatPath: '/chat/completions', authPrefix: 'Bearer' },
    ark: { baseUrlTemplate: 'https://ark.cn-beijing.volces.com/api/v3', chatPath: '/chat/completions', authPrefix: 'Bearer' },
    zhipu: { baseUrlTemplate: 'https://open.bigmodel.cn/api/paas/v4', chatPath: '/chat/completions', authPrefix: 'Bearer' },
    moonshot: { baseUrlTemplate: 'https://api.moonshot.cn/v1', chatPath: '/chat/completions', authPrefix: 'Bearer' },
    hunyuan: { baseUrlTemplate: 'https://api.hunyuan.cloud.tencent.com/v1', chatPath: '/chat/completions', authPrefix: 'Bearer' },
    qwen: { baseUrlTemplate: 'https://dashscope.aliyuncs.com/compatible-mode/v1', chatPath: '/chat/completions', authPrefix: 'Bearer' },
    custom: { baseUrlTemplate: '', chatPath: '/chat/completions', authPrefix: 'Bearer' },
  };
  const provider = map[id];
  if (!provider) throw new Error(`未知 Provider: ${id}`);
  return provider;
}

function resolveBaseUrl(providerId: string, customBaseUrl?: string): string {
  const provider = providerById(providerId);
  const raw = providerId === 'custom' ? customBaseUrl?.trim() : provider.baseUrlTemplate;
  if (!raw) throw new Error('自定义 Provider 需要填写 baseUrl');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('baseUrl 不是有效 URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('baseUrl 仅支持 http 或 https');
  if (url.username || url.password || url.search || url.hash) throw new Error('baseUrl 不得包含凭据、查询参数或片段');
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path === '/' ? '' : path}`;
}

function isTrustedRenderer(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (isDev) return url.origin === 'http://localhost:5173';
    if (!trustedRendererUrl) return false;
    const trusted = new URL(trustedRendererUrl);
    url.hash = '';
    trusted.hash = '';
    return url.href === trusted.href;
  } catch {
    return false;
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedRenderer(event.senderFrame?.url ?? '')) throw new Error('拒绝来自非应用页面的 IPC 请求');
}

function isExternalWebUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

function registerIpc(): void {
  ipcMain.handle('keychain:has', (event, providerId: string) => {
    assertTrustedSender(event);
    providerById(providerId);
    return !!keys[providerId];
  });
  ipcMain.handle('keychain:set', (event, providerId: string, apiKey: string) => {
    assertTrustedSender(event);
    providerById(providerId);
    if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 10_000) return false;
    keys[providerId] = apiKey;
    saveKeys(keys);
    return true;
  });
  ipcMain.handle('keychain:delete', (event, providerId: string) => {
    assertTrustedSender(event);
    providerById(providerId);
    if (keys[providerId]) {
      delete keys[providerId];
      saveKeys(keys);
    }
    return true;
  });
  ipcMain.handle('ai:chat', (event, req: AiProxyRequest) => {
    assertTrustedSender(event);
    return proxyChat(req);
  });

  // 联网检索代理（Key 用 jobApiKey 直传，不做持久化）
  ipcMain.handle('search:web', async (event, req: { providerId: 'bing' | 'serper'; apiKey: string; query: string }) => {
    try {
      assertTrustedSender(event);
      if (!req || (req.providerId !== 'bing' && req.providerId !== 'serper')) return { ok: false, error: '搜索请求结构无效' };
      if (typeof req.apiKey !== 'string' || !req.apiKey.trim()) return { ok: false, error: '请输入检索 API Key' };
      const q = String(req.query).trim();
      if (!q) return { ok: false, error: '请输入检索词' };
      if (req.providerId === 'serper') {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': req.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, num: 5 }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return { ok: false, error: `Serper 搜索失败：HTTP ${res.status}` };
        const data = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
        return { ok: true, results: (data.organic ?? []).map((x) => ({ title: x.title ?? '', url: x.link ?? '', snippet: x.snippet ?? '' })) };
      }
      const res = await fetch(`https://api.cognitive.microsoft.com/bing/v7.0/search?q=${encodeURIComponent(q)}&count=5`, {
        headers: { 'Ocp-Apim-Subscription-Key': req.apiKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, error: `必应搜索失败：HTTP ${res.status}` };
      const data = (await res.json()) as { webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> } };
      return { ok: true, results: (data.webPages?.value ?? []).map((x) => ({ title: x.name ?? '', url: x.url ?? '', snippet: x.snippet ?? '' })) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    show: false,
    title: '玄枢 · 八术综合占卜工作台',
    backgroundColor: '#f6f3ec',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Win11 Mica 背景（保留原生标题栏以获 Snap Layouts）
  if (process.platform === 'win32') {
    try {
      (win as unknown as { setBackgroundMaterial?: (m: string) => void }).setBackgroundMaterial?.('mica');
    } catch {
      /* 非 Win11 或旧版本忽略 */
    }
  }
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRenderer(url)) return;
    event.preventDefault();
    if (isExternalWebUrl(url)) void shell.openExternal(url);
  });

  // CSP（渲染进程安全）
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:;",
        ],
      },
    });
  });

  if (isDev) {
    trustedRendererUrl = 'http://localhost:5173/';
    void win.loadURL(trustedRendererUrl);
  } else {
    // 打包后 web 静态资源经 extraResources 置于 resources/web-dist；开发模式回退仓库内 dist
    const packed = join(process.resourcesPath, 'web-dist', 'index.html');
    const dev = join(app.getAppPath(), '..', 'web', 'dist', 'index.html');
    const target = existsSync(packed) ? packed : dev;
    trustedRendererUrl = pathToFileURL(target).href;
    void win.loadFile(target);
  }
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'system';
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

export {};
