#!/usr/bin/env node
/** 全仓类型检查：对 packages/* 与 apps/desktop 逐个 tsc --noEmit */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(ROOT, '.env.node');
const nodeLine = existsSync(envFile)
  ? readFileSync(envFile, 'utf-8').split(/\r?\n/).find((line) => line.trim().startsWith('NODE_BIN='))
  : undefined;
if (!nodeLine) throw new Error('.env.node 缺少 NODE_BIN=<node.exe 绝对路径>');
const nodeBin = nodeLine.slice('NODE_BIN='.length).trim();
if (!existsSync(nodeBin)) throw new Error(`NODE_BIN 指向不存在：${nodeBin}`);
const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

let failed = 0;
const targets = [
  ...readdirSync(join(ROOT, 'packages')).map((p) => join(ROOT, 'packages', p)),
  join(ROOT, 'apps', 'web'),
  join(ROOT, 'apps', 'desktop'),
];
for (const dir of targets) {
  const cfg = join(dir, 'tsconfig.json');
  if (!existsSync(cfg)) continue;
  const r = spawnSync(nodeBin, [tsc, '--noEmit', '-p', cfg], { stdio: 'inherit' });
  if (r.status !== 0) failed += 1;
  else console.log(`✓ ${dir.split(/[\\/]/).pop()}`);
}
if (failed > 0) process.exit(1);
console.log('typecheck 全部通过');
