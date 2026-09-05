/**
 * 插件注册表：注册、查询、校验（configHash / normalize / compute 是否纯函数化）
 */

import type { ShuPlugin } from './contract.js';

const registry = new Map<string, ShuPlugin>();

export function registerPlugin(plugin: ShuPlugin): void {
  if (registry.has(plugin.id)) {
    throw new Error(`插件已存在: ${plugin.id}`);
  }
  registry.set(plugin.id, plugin);
}

export function getPlugin(id: string): ShuPlugin {
  const p = registry.get(id);
  if (!p) throw new Error(`插件未注册: ${id}`);
  return p;
}

export function hasPlugin(id: string): boolean {
  return registry.has(id);
}

export function listPlugins(): ShuPlugin[] {
  return [...registry.values()];
}

export function pluginsByArt(art: string): ShuPlugin[] {
  return listPlugins().filter((p) => p.art === art);
}

export function listArts(): string[] {
  return [...new Set(listPlugins().map((p) => p.art))];
}

/** 计算配置哈希（稳定 JSON 序列化） */
export function configHashOf(config: Record<string, unknown>): string {
  const stable = JSON.stringify(config, (k, v) => (v === undefined ? null : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'cfg_' + h.toString(16).padStart(8, '0');
}

/** 校验插件契约完整性（verify-playbook 也会用到） */
export function validatePlugin(p: ShuPlugin): string[] {
  const errors: string[] = [];
  if (!p.id || !p.name || !p.version) errors.push(`${p.id ?? '<no-id>'}: 缺 id/name/version`);
  if (typeof p.normalize !== 'function') errors.push(`${p.id}: 缺 normalize`);
  if (typeof p.compute !== 'function') errors.push(`${p.id}: 缺 compute`);
  if (typeof p.rules !== 'function') errors.push(`${p.id}: 缺 rules`);
  if (typeof p.board !== 'function') errors.push(`${p.id}: 缺 board`);
  if (!p.intake?.categories?.length) errors.push(`${p.id}: intake.categories 为空`);
  if (typeof p.answer?.templateFor !== 'function') errors.push(`${p.id}: 缺 answer.templateFor`);
  return errors;
}
