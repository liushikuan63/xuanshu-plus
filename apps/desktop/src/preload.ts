/**
 * 玄枢桌面端 preload 桥（v8 §10.4）
 * sandbox + contextIsolation 下仅暴露受控 API：
 *  - platform.isDesktop：渲染进程检测桌面环境
 *  - keychain.has/set/delete：AI Key 存主进程 safeStorage（DPAPI），Key 不进 localStorage
 *  - ai.chat / ai.test：主进程持 Key 代理 OpenAI 兼容请求
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xuanshuDesktop', {
  isDesktop: true,
  platform: process.platform,
  keychain: {
    has: (providerId: string): Promise<boolean> => ipcRenderer.invoke('keychain:has', providerId),
    set: (providerId: string, apiKey: string): Promise<boolean> => ipcRenderer.invoke('keychain:set', providerId, apiKey),
    delete: (providerId: string): Promise<boolean> => ipcRenderer.invoke('keychain:delete', providerId),
  },
  ai: {
    chat: (req: unknown): Promise<unknown> => ipcRenderer.invoke('ai:chat', req),
    test: (req: unknown): Promise<unknown> => ipcRenderer.invoke('ai:chat', { ...(req as object), testOnly: true }),
  },
  search: {
    web: (req: unknown): Promise<unknown> => ipcRenderer.invoke('search:web', req),
  },
});
