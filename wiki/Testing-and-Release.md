# 测试与发布

## 提交门禁

```powershell
npm run doctor
npm test
npm run typecheck
npm run build:web
npm run desktop:build
```

当前基线为 20 个测试文件、271 项测试。`typecheck` 覆盖 7 个领域包、Web 和 Electron。GitHub Actions 在每次 push 与 pull request 上运行测试、类型检查和 Web 构建。

## 按改动选择附加验证

| 改动 | 附加检查 |
|---|---|
| 历法/排盘 | `npm run golden`，并运行对应术数测试文件 |
| 引用/语料 | `npm run verify-citation`，必要时重新生成引用列表 |
| playbook | `npm run verify-playbook` |
| 知识库缓存 | 首次加载与二次加载各一次，验证 IndexedDB 命中和语料更新失效 |
| 案例本 | 导入、导出、重复记录、checksum 篡改、存储配额失败 |
| 响应式 UI | 按 [响应式设计](Responsive-Design.md) 的六个视口检查首屏、盘面、AI、案例和阅读器 |
| Electron 安全 | 外链打开、主窗口导航拦截、受信 IPC、DPAPI Key 保存/删除 |
| Android | `npm run android:sync`、`npm run android:build`，再在模拟器或真机执行专项脚本 |

## 知识库引用列表

内置语料变更后运行：

```powershell
npm run generate-kb-citations
```

该脚本从 `builtinCorpus()` 生成 `docs/内置知识库引用列表.md` 和机器索引。机器索引是可再生文件，不提交 Git。

## 发布产物

- Web：`apps/web/dist/`
- Electron：`apps/desktop/release/`
- Android：`release/xuanshu-debug.apk`

以上均为构建产物，已从 Git 排除。发布应由带版本号的 GitHub Release 或受控流水线承载，不应直接提交二进制到主分支。

## 当前限制

- CI 不构建 Windows Electron 安装包和 Android APK，这两类发布仍需对应平台环境验收。
- 仓库没有浏览器端自动化测试框架，响应式与交互目前依赖构建检查、脚本和人工/自动化浏览器验收。
- 典籍异步块仍约 4.93 MB（gzip 约 799 KB）；它已移出首屏包，但弱网和低端设备仍需持续测量加载时间与内存占用。
