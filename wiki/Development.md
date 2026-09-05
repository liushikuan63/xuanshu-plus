# 开发指南

## 环境要求

- Node.js 22 或更高版本
- npm（随 Node 安装）
- Windows 桌面打包需要 Electron 依赖
- Android 构建需要 JDK 21、Android SDK 和项目内 Gradle Wrapper

仓库用 `.env.node` 固定实际执行测试/构建的 Node，避免系统 `PATH` 指向旧版本。先创建本机文件：

```powershell
Copy-Item .env.node.example .env.node
```

然后把 `NODE_BIN` 改为本机 `node.exe` 的绝对路径。`.env.node` 已被 Git 忽略。

## 初始化

```powershell
npm install
npm run doctor
npm test
npm run typecheck
```

`npm run typecheck` 必须同时检查 7 个领域包、`apps/web` 和 `apps/desktop`。不能只依赖 Vite 构建，因为 Vite 会转译 TypeScript，但不代替完整的 `tsc --noEmit`。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev:web` | 启动 Web 开发服务器 |
| `npm run build:web` | 构建 Web 生产包 |
| `npm run desktop:build` | 编译 Electron 主进程和 preload |
| `npm run desktop:dev` | 连接本地 Vite 服务启动 Electron |
| `npm run desktop:dist` | 构建 Windows 安装包和 portable 包 |
| `npm run android:sync` | 把 Web 产物同步到 Capacitor Android |
| `npm run android:build` | 构建 Android debug APK |
| `npm run golden` | 运行/生成核心黄金样本 |
| `npm run verify-citation` | 校验引用 |
| `npm run verify-playbook` | 校验事项路径卡 |

## 开发约定

- 排盘算法放在 `packages/core/src/arts/<art>`，并配同目录测试。
- 平台 API 通过桥接层进入 UI，不要在领域包中直接访问 Electron 或浏览器全局。
- 外部 JSON、AI 响应和 IPC 参数都视为不可信输入，必须做运行时校验。
- 新增引用时保留稳定 `segId`，并明确 `confidenceLevel` 与许可信息。
- AI 输出始终标记为 E 级；模型返回的 `citationVerified` 不可信，客户端必须覆盖为 `false`。
- 不提交 `dist/`、`build/`、`release/`、APK、EXE、`.env.node` 或 Android `local.properties`。

## 新增术数

1. 在 `packages/core/src/arts/<art>` 实现引擎、规则、插件和测试。
2. 从 `packages/core/src/index.ts` 导出插件与类型。
3. 在 `apps/web/src/App.tsx` 注册插件、输入方式和标题/副标题展示。
4. 为盘面提供 `BoardSpec`，不要在 UI 中硬编码领域算法。
5. 更新 Wiki、操作手册和相关黄金样本。
