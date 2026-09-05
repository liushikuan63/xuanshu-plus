#!/usr/bin/env node
/**
 * 玄枢统一命令入口 run.mjs
 * 所有子命令一律经由 .env.node 中锁定的 Node 绝对路径执行。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function envNodeBin() {
  const envFile = join(ROOT, '.env.node');
  if (!existsSync(envFile)) {
    throw new Error('.env.node 不存在，请先创建并写入 NODE_BIN=<node.exe 绝对路径>');
  }
  const line = readFileSync(envFile, 'utf-8').split(/\r?\n/).find((l) => l.trim().startsWith('NODE_BIN='));
  if (!line) throw new Error('.env.node 缺少 NODE_BIN 行');
  const bin = line.slice('NODE_BIN='.length).trim();
  if (!existsSync(bin)) throw new Error(`NODE_BIN 指向不存在：${bin}`);
  return bin;
}

const NODE = envNodeBin();
const npmCli = [
  process.env.npm_execpath,
  process.env.npm_config_prefix ? join(process.env.npm_config_prefix, 'node_modules', 'npm', 'bin', 'npm-cli.js') : undefined,
  join(dirname(NODE), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  'D:\\Java\\nodejs\\node_global\\node_modules\\npm\\bin\\npm-cli.js',
].find((candidate) => candidate && existsSync(candidate));
if (!npmCli) throw new Error('找不到 npm-cli.js；请确认 Node 安装包含 npm，或通过 npm run 调用本脚本');
const desktopDir = join(ROOT, 'apps', 'desktop');
const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const vitestBin = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const typecheckScript = join(ROOT, 'scripts', 'typecheck.mjs');

function run(args, opts = {}) {
  const r = spawnSync(NODE, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (r.error) throw r.error;
  return r.status;
}

function npm(args, opts = {}) {
  // 生命周期脚本（vite/tsc）经 PATH 解析 `node`，需预置可用 node 目录（系统 PATH 中 node 是死链接）
  const nodeDir = dirname(NODE);
  const env = { ...process.env, ...(opts.env ?? {}), PATH: `${nodeDir}${delimiter}${process.env.PATH ?? ''}` };
  return run([npmCli, ...args], { ...opts, env });
}

const doctor = () => {
  console.log(`[doctor] Node: ${NODE}`);
  run(['--version']);
  const checks = [
    ['node_modules 已安装', existsSync(join(ROOT, 'node_modules'))],
    ['typescript', existsSync(join(ROOT, 'node_modules', 'typescript'))],
    ['vitest', existsSync(join(ROOT, 'node_modules', 'vitest'))],
    ['tsx', existsSync(join(ROOT, 'node_modules', 'tsx'))],
    ['lunar-javascript', existsSync(join(ROOT, 'node_modules', 'lunar-javascript'))],
    ['iztro', existsSync(join(ROOT, 'node_modules', 'iztro'))],
    ['.env.node', existsSync(join(ROOT, '.env.node'))],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
    if (!pass) ok = false;
  }
  if (!ok) {
    console.log('[doctor] 存在缺失项，请先运行：node scripts/run.mjs install');
    process.exit(1);
  }
  console.log('[doctor] 全部通过');
};

const sub = process.argv[2] ?? 'help';
switch (sub) {
  case 'doctor': doctor(); break;
  case 'install': process.exit(npm(['install'])); break;
  case 'test': process.exit(run([vitestBin, 'run'])); break;
  case 'typecheck': process.exit(run([typecheckScript])); break;
  case 'build': process.exit(npm(['run', 'build', '--workspace', '@xuanshu/web'])); break;
  case 'build:web': process.exit(npm(['run', 'build', '--workspace', '@xuanshu/web'])); break;
  case 'dev:web': process.exit(npm(['run', 'dev', '--workspace', '@xuanshu/web'])); break;
  case 'cal': process.exit(npm(['run', 'cal', '--workspace', '@xuanshu/core'])); break;
  case 'golden': process.exit(npm(['run', 'golden', '--workspace', '@xuanshu/core'])); break;
  case 'verify-citation': process.exit(npm(['run', 'verify-citation', '--workspace', '@xuanshu/reader'])); break;
  case 'verify-playbook': process.exit(npm(['run', 'verify-playbook', '--workspace', '@xuanshu/intake'])); break;
  case 'generate-kb-citations': process.exit(run([join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(ROOT, 'scripts', 'generate-kb-citations.mjs')])); break;
  case 'android:build': process.exit(buildAndroid('debug')); break;
  case 'android:sync': process.exit(capSync()); break;
  case 'desktop:build': process.exit(buildDesktop()); break;
  case 'desktop:dev': process.exit(desktopDev()); break;
  case 'desktop:dist': process.exit(distDesktop()); break;
  default:
    console.log(`用法: node scripts/run.mjs <command>

命令:
  doctor            环境体检（Node/npm/依赖）
  install           npm install（workspaces）
  test              vitest run（全量）
  typecheck         全仓 tsc --noEmit
  build:web         Vite 构建 Web 工作台
  dev:web           启动 Web 开发服务器
  cal               历法校准报告（1900-2100 节气 vs lunar）
  golden            黄金样本生成/校验
  verify-citation   引用有效性校验（reader）
  verify-playbook   playbook 完整性校验（intake）
  generate-kb-citations 重新生成内置知识库引用列表
  android:sync      Capacitor sync android（同步 Web 资源与插件）
  android:build     构建 Android debug APK（输出 release/xuanshu-debug.apk）
  desktop:build     仅编译电子壳（tsc → apps/desktop/dist）
  desktop:dev       启动 Electron 壳（需先另开 dev:web 供 localhost:5173）
  desktop:dist      构建 Web + 电子壳 + electron-builder 打包（release 安装包）
`);
    process.exit(sub === 'help' ? 0 : 1);
}

function buildAndroid(variant) {
  const androidDir = join(ROOT, 'apps', 'web', 'android');
  if (!existsSync(join(androidDir, 'gradlew.bat'))) {
    console.error('安卓工程不存在，先运行：npm run add:android 或 npx cap add android');
    return 1;
  }
  // 强制使用标准 Temurin JDK 21（忽略环境里陈旧的 JAVA_HOME=jdk1.8 等）
  const javaHome = process.env.ANDROID_JAVA_HOME || 'D:\\Java\\jdk\\jdk-21.0.12.1+1';
  const env = {
    ...process.env,
    ANDROID_HOME: process.env.ANDROID_HOME || 'D:\\Android\\Sdk',
    JAVA_HOME: javaHome,
    PATH: `${javaHome}\\bin;${process.env.PATH ?? ''}`,
  };
  // Windows 下 .bat 需经 shell 执行；在线解析失败时自动降级 --offline（本地缓存）
  const gradlew = join(androidDir, 'gradlew.bat');
  let r = spawnSync(gradlew, ['assembleDebug', '--no-daemon'], { stdio: 'inherit', cwd: androidDir, env, shell: true });
  if (r.status !== 0) {
    console.log('→ 在线依赖解析失败，尝试 --offline（本地 Gradle 缓存）…');
    r = spawnSync(gradlew, ['assembleDebug', '--no-daemon', '--offline'], { stdio: 'inherit', cwd: androidDir, env, shell: true });
  }
  if (r.status !== 0) return r.status;
  const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (existsSync(apk)) {
    const releaseDir = join(ROOT, 'release');
    mkdirSync(releaseDir, { recursive: true });
    copyFileSync(apk, join(releaseDir, `xuanshu-${variant}.apk`));
    console.log(`✓ APK 已生成：release/xuanshu-${variant}.apk`);
  }
  return 0;
}

function capSync() {
  const capCli = join(ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
  return run([capCli, 'sync', 'android'], { cwd: join(ROOT, 'apps', 'web') });
}

/** 编译 Electron 主进程/预加载（tsc → apps/desktop/dist） */
function buildDesktop() {
  return run([tscBin, '-p', join(desktopDir, 'tsconfig.json')], { cwd: desktopDir });
}

/** 开发模式：以 XUANSHU_DEV=1 启动本地 electron（加载 http://localhost:5173） */
function desktopDev() {
  const electronBin = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (!existsSync(electronBin)) {
    console.error('Electron 二进制缺失：先运行 node node_modules/electron/install.js 重新下载');
    return 1;
  }
  buildDesktop();
  const env = { ...process.env, XUANSHU_DEV: '1' };
  const r = spawnSync(electronBin, ['.'], { stdio: 'inherit', cwd: desktopDir, env });
  return r.error ? 1 : (r.status ?? 0);
}

/** 打包：先构建 Web dist + 编译电子壳，再 electron-builder 产出 NSIS/portable */
function distDesktop() {
  // 1) Web 静态资源（electron-builder.yml extraResources 引用 ../web/dist → resources/web-dist）
  const webBuild = npm(['run', 'build', '--workspace', '@xuanshu/web']);
  if (webBuild !== 0) return webBuild;
  buildDesktop();
  const ebCli = join(ROOT, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
  if (!existsSync(ebCli)) {
    console.error('electron-builder 未安装：请重新 npm install');
    return 1;
  }
  const env = {
    ...process.env,
    PATH: `${dirname(NODE)}${delimiter}${process.env.PATH ?? ''}`,
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/',
    NODE_NO_WARNINGS: '1',
    npm_config_loglevel: 'error',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    npm_config_update_notifier: 'false',
  };
  return run([ebCli, '--win', '--x64', '--config', join(desktopDir, 'electron-builder.yml')], { cwd: desktopDir, env });
}
