/**
 * 桌面端桥接适配（v8 §10.4）：检测 Electron preload 暴露的 `xuanshuDesktop`。
 *  - 桌面端：AI Key 经 keychain 存主进程 safeStorage(DPAPI)；chat/test 由主进程代理（Key 不进 localStorage）
 *  - Web 端：保持内存 Key + 直接 fetch（现状）
 * 类型定义与 Web 端共用，供 App.tsx 按环境选择调用路径。
 */

export interface DesktopAiRequest {
  providerId: string;
  baseUrl?: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  responseJson?: boolean;
  maxTokens?: number;
}

export interface DesktopAiResult {
  ok: boolean;
  content?: string;
  error?: string;
  models?: string[];
}

export interface XuanshuDesktopBridge {
  isDesktop: boolean;
  platform: string;
  keychain: {
    has(providerId: string): Promise<boolean>;
    set(providerId: string, apiKey: string): Promise<boolean>;
    delete(providerId: string): Promise<boolean>;
  };
  ai: {
    chat(req: DesktopAiRequest): Promise<DesktopAiResult>;
    test(req: DesktopAiRequest): Promise<DesktopAiResult>;
  };
  /** 联网检索（主进程代理，免 CORS） */
  search?: {
    web(req: { providerId: 'bing' | 'serper'; apiKey: string; query: string }): Promise<{ ok: boolean; results?: Array<{ title: string; url: string; snippet: string }>; error?: string }>;
  };
}

declare global {
  interface Window {
    xuanshuDesktop?: XuanshuDesktopBridge;
  }
}

/** 当前是否运行于 Electron 桌面端（preload 桥可用） */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.xuanshuDesktop?.isDesktop;
}

export function desktopBridge(): XuanshuDesktopBridge | undefined {
  return window.xuanshuDesktop;
}
