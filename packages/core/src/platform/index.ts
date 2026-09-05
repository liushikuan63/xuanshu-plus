/** 当前运行壳及其真实能力，不把尚未接入的原生插件当成可用能力。 */

export type ShellKind = 'web' | 'desktop' | 'mobile';

export type Capability =
  | 'calculation'
  | 'caseLedger'
  | 'knowledgeSearch'
  | 'fileImport'
  | 'keyStorage'
  | 'aiProxy'
  | 'notifications'
  | 'backup'
  | 'webSearch';

export type CapabilityLevel = 'full' | 'limited' | 'unavailable';

export interface CapabilityInfo {
  level: CapabilityLevel;
  note: string;
  via?: string;
}

export interface KeyStoreSpec {
  backend: 'memory-only' | 'safeStorage';
  mayPersist: boolean;
  forbidden: string[];
  warning: string;
}

export interface PlatformAdapter {
  kind: ShellKind;
  label: string;
  capabilities: Record<Capability, CapabilityInfo>;
  keyStore: KeyStoreSpec;
  can(capability: Capability): CapabilityInfo;
  limitation(capability: Capability, action: string): string;
}

export interface PlatformFacts {
  userAgent?: string;
  hasDesktopBridge?: boolean;
  hasCapacitor?: boolean;
  notificationApi?: boolean;
}

export const ALL_CAPABILITIES: readonly Capability[] = [
  'calculation',
  'caseLedger',
  'knowledgeSearch',
  'fileImport',
  'keyStorage',
  'aiProxy',
  'notifications',
  'backup',
  'webSearch',
];

const capability = (level: CapabilityLevel, note: string, via?: string): CapabilityInfo => ({
  level,
  note,
  via,
});

const SHARED: Pick<Record<Capability, CapabilityInfo>, 'calculation' | 'caseLedger' | 'knowledgeSearch'> = {
  calculation: capability('full', '确定性排盘内核离线运行，不依赖运行壳或网络'),
  caseLedger: capability('full', '案例本保存在当前运行壳的 IndexedDB 中', 'IndexedDB'),
  knowledgeSearch: capability('full', '随包知识库可在本地检索', 'BM25'),
};

function buildCapabilities(kind: ShellKind, facts: PlatformFacts): Record<Capability, CapabilityInfo> {
  if (kind === 'desktop') {
    return {
      ...SHARED,
      fileImport: capability('limited', '通过渲染层文件选择器读取用户明确选择的文件', 'File API'),
      keyStorage: capability('full', 'AI 密钥经主进程 safeStorage 加密后保存', 'Electron safeStorage'),
      aiProxy: capability('full', 'AI 请求由 Electron 主进程代理，不受浏览器 CORS 限制', 'main process'),
      notifications: capability('unavailable', '当前版本尚未接入桌面通知'),
      backup: capability('full', '以下载文件形式导出案例备份', 'download'),
      webSearch: capability('full', '联网检索由 Electron 主进程代理', 'main process'),
    };
  }

  if (kind === 'mobile') {
    return {
      ...SHARED,
      fileImport: capability('limited', '仅能读取用户通过系统选择器明确授权的文件', 'WebView File API'),
      keyStorage: capability('limited', '尚未接入 Android Keystore，密钥只能保留在当前页面内存'),
      aiProxy: capability('limited', '当前使用 WebView 直连，只支持允许跨域的 HTTPS 服务'),
      notifications: capability('unavailable', '当前版本尚未接入 Android 原生通知插件'),
      backup: capability('limited', '当前通过 WebView 下载导出，部分系统版本可能需要手动确认保存位置'),
      webSearch: capability('limited', '当前使用 WebView 直连，可能受服务端跨域策略限制'),
    };
  }

  return {
    ...SHARED,
    fileImport: capability('limited', '浏览器只能读取用户主动选择的文件', 'File API'),
    keyStorage: capability('limited', '密钥只保留在当前页面内存，刷新后需重新填写'),
    aiProxy: capability('limited', '浏览器直连可能受服务端 CORS 策略限制'),
    notifications: facts.notificationApi
      ? capability('limited', '浏览器支持通知 API，但当前版本尚未建立后台提醒流程', 'Notification API')
      : capability('unavailable', '当前浏览器不支持通知 API'),
    backup: capability('full', '以下载文件形式导出案例备份', 'download'),
    webSearch: capability('limited', '浏览器直连检索服务可能受 CORS 策略限制'),
  };
}

function keyStoreFor(kind: ShellKind): KeyStoreSpec {
  if (kind === 'desktop') {
    return {
      backend: 'safeStorage',
      mayPersist: true,
      forbidden: ['localStorage', 'sessionStorage', 'IndexedDB', 'cookie'],
      warning: '桌面密钥只能经 Electron safeStorage 持久化，不能写入 Web 存储。',
    };
  }

  return {
    backend: 'memory-only',
    mayPersist: false,
    forbidden: ['localStorage', 'sessionStorage', 'IndexedDB', 'cookie', 'Preferences'],
    warning: kind === 'mobile'
      ? 'Android Keystore 尚未接入，当前版本不得把密钥写入 Preferences 或 Web 存储。'
      : '网页端密钥不得持久化，只能保留在当前页面内存。',
  };
}

export function detectPlatform(facts: PlatformFacts = {}): PlatformAdapter {
  const kind: ShellKind = facts.hasDesktopBridge
    ? 'desktop'
    : facts.hasCapacitor || /Android/i.test(facts.userAgent ?? '')
      ? 'mobile'
      : 'web';
  const label = kind === 'desktop' ? '桌面版' : kind === 'mobile' ? 'Android 版' : '网页版';
  const capabilities = buildCapabilities(kind, facts);

  return {
    kind,
    label,
    capabilities,
    keyStore: keyStoreFor(kind),
    can: (name) => capabilities[name],
    limitation: (name, action) => {
      const info = capabilities[name];
      return info.level === 'full' ? '' : `${action}在${label}${info.level === 'limited' ? '受限' : '不可用'}：${info.note}`;
    },
  };
}

export function checkKeyWrite(
  adapter: PlatformAdapter,
  backend: string,
): { ok: true } | { ok: false; reason: string } {
  const forbidden = adapter.keyStore.forbidden.find((name) =>
    backend.toLowerCase().includes(name.toLowerCase()),
  );
  if (forbidden) {
    return {
      ok: false,
      reason: `${adapter.label}禁止使用 ${forbidden} 保存 AI 密钥。${adapter.keyStore.warning}`,
    };
  }
  if (!adapter.keyStore.mayPersist || backend !== adapter.keyStore.backend) {
    return {
      ok: false,
      reason: `${adapter.label}不能将 AI 密钥持久化到 ${backend}。${adapter.keyStore.warning}`,
    };
  }
  return { ok: true };
}
