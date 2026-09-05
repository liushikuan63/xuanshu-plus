# 数据与安全

## 数据位置

| 数据 | Web/Android | Electron |
|---|---|---|
| 当前盘面 | React 内存 | React 内存 |
| 案例本 | `localStorage` 的 `xuanshu.cases.v1` | 当前同样由渲染层本地存储 |
| 知识库快照 | IndexedDB `xuanshu-knowledge` | Chromium IndexedDB |
| AI Key | 页面内存，刷新即丢失 | `%APPDATA%` 下应用 `userData/keys.json`，由 `safeStorage`/DPAPI 加密 |
| 搜索 API Key | 页面内存；请求时发送 | 页面内存；经 IPC 直传主进程代理，不持久化 |

“DPAPI 加密落盘”不等于“不落盘”。密钥文件绑定当前 Windows 用户加密，渲染进程不能读取明文，但同一系统用户上下文中的恶意程序仍属于剩余风险。

## Electron 信任边界

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- preload 只暴露 keychain、AI 和搜索的窄接口
- IPC handler 校验调用方页面 URL
- 主窗口阻止导航到外部页面，HTTP(S) 链接交给系统浏览器
- CSP 限制脚本、图片和连接来源
- 内置厂商固定使用官方 Base URL；任意端点必须显式选择 `custom`
- 自定义 Base URL 只允许 HTTP(S)，拒绝内嵌凭据、查询参数和片段

## 外部输入

案例导入支持带 `meta/records` 的当前格式和旧版裸数组：

- 有 checksum 的文件必须先通过完整性校验。
- 每条记录必须满足运行时结构校验。
- 同 `caseId` 冲突时，先比较 `revision`，再比较更新时间。
- 损坏记录不会进入列表和统计逻辑。
- localStorage 写入失败会抛出明确错误，并保留写入前的内存状态。

checksum 用于发现意外损坏，不是数字签名，不能证明文件来源。

CSV 导出会对以 `=`, `+`, `-`, `@` 或控制字符开头的单元格加前缀，降低用 Excel 等表格程序打开时的公式注入风险。

## AI 边界

- 模型只接收结构化盘面、规则命中和检索片段，不参与历法或排盘计算。
- 模型响应按运行时结构解析，非法判断卡会被丢弃。
- `confidence` 被限制在 0 到 1。
- 不信任模型声称的引用校验结果，统一设置 `citationVerified: false`。
- 默认请求超时 120 秒；联网搜索超时 15 秒。
- 医疗、法律、财务等事项只提供趋势参考，必须保留专业意见提示。

## 提交前检查

运行 `git status --short`，确认没有 `.env.node`、密钥、APK、EXE、`local.properties`、`dist/`、`build/` 或 `release/` 文件进入暂存区。
