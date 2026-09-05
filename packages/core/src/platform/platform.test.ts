import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES, checkKeyWrite, detectPlatform } from './index.js';

describe('运行壳检测', () => {
  it('桌面桥优先于移动端标记', () => {
    expect(detectPlatform({ hasDesktopBridge: true, hasCapacitor: true }).kind).toBe('desktop');
  });

  it('Capacitor 或 Android UA 判定为移动端', () => {
    expect(detectPlatform({ hasCapacitor: true }).kind).toBe('mobile');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }).kind).toBe('mobile');
  });

  it('普通浏览器与未注入 Capacitor 的 iPad 保持网页版', () => {
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }).kind).toBe('web');
    expect(detectPlatform({ userAgent: 'iPad; CPU OS 17_0' }).kind).toBe('web');
  });
});

describe('能力矩阵', () => {
  it.each([
    ['web', detectPlatform({})],
    ['desktop', detectPlatform({ hasDesktopBridge: true })],
    ['mobile', detectPlatform({ hasCapacitor: true })],
  ] as const)('%s 每项能力都有明确等级与说明', (_name, adapter) => {
    for (const name of ALL_CAPABILITIES) {
      expect(['full', 'limited', 'unavailable']).toContain(adapter.can(name).level);
      expect(adapter.can(name).note.length).toBeGreaterThan(8);
    }
  });

  it('三端排盘、案例本和知识检索均可离线使用', () => {
    for (const adapter of [
      detectPlatform({}),
      detectPlatform({ hasDesktopBridge: true }),
      detectPlatform({ hasCapacitor: true }),
    ]) {
      expect(adapter.can('calculation').level).toBe('full');
      expect(adapter.can('caseLedger').level).toBe('full');
      expect(adapter.can('knowledgeSearch').level).toBe('full');
    }
  });

  it('不把尚未接入的 Android 原生能力标记为完整可用', () => {
    const mobile = detectPlatform({ hasCapacitor: true });
    expect(mobile.can('keyStorage').level).toBe('limited');
    expect(mobile.can('notifications').level).toBe('unavailable');
    expect(mobile.can('backup').level).toBe('limited');
  });

  it('受限能力返回面向当前壳的原因', () => {
    const mobile = detectPlatform({ hasCapacitor: true });
    expect(mobile.limitation('aiProxy', '连接模型')).toContain('Android 版受限');
    expect(mobile.limitation('aiProxy', '连接模型')).toContain('HTTPS');
    expect(mobile.limitation('calculation', '排盘')).toBe('');
  });
});

describe('密钥持久化边界', () => {
  it('桌面只允许 safeStorage，拒绝所有 Web 存储', () => {
    const desktop = detectPlatform({ hasDesktopBridge: true });
    expect(checkKeyWrite(desktop, 'safeStorage')).toEqual({ ok: true });
    for (const backend of ['localStorage', 'sessionStorage', 'IndexedDB', 'cookie']) {
      expect(checkKeyWrite(desktop, backend).ok).toBe(false);
    }
  });

  it('Web 与 Android 当前均拒绝持久化密钥', () => {
    for (const adapter of [detectPlatform({}), detectPlatform({ hasCapacitor: true })]) {
      expect(adapter.keyStore.mayPersist).toBe(false);
      expect(checkKeyWrite(adapter, 'localStorage').ok).toBe(false);
      expect(checkKeyWrite(adapter, 'safeStorage').ok).toBe(false);
    }
    expect(checkKeyWrite(detectPlatform({ hasCapacitor: true }), 'Preferences').ok).toBe(false);
  });
});
