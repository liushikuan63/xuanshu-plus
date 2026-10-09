# 玄枢八术 xuanshu-plus

玄枢八术是一个本地优先的综合术数工作台，当前提供 Web、Electron 和 Android 三种运行形态，包含八种排盘能力、事项引导、典籍检索、引用回链、案例本及可选 AI 精解。

## 快速开始

1. 安装 Node.js 22 或更高版本。
2. 将 `.env.node.example` 复制为 `.env.node`，填写本机 `node` 可执行文件的绝对路径。
3. 运行 `npm install`。
4. 运行 `npm run doctor`、`npm test` 和 `npm run typecheck`。
5. 运行 `npm run dev:web`，打开终端显示的本地地址。

## 文档

- [Wiki 首页](wiki/Home.md)
- [系统架构](wiki/Architecture.md)
- [功能矩阵](wiki/Feature-Matrix.md)
- [开发指南](wiki/Development.md)
- [响应式设计](wiki/Responsive-Design.md)
- [数据与安全](wiki/Data-and-Security.md)
- [测试与发布](wiki/Testing-and-Release.md)
- [代码审查记录](wiki/Code-Review-2026-09-05.md)
- [双源项目合并审查](wiki/Merge-Review-2026-09-05.md)
- [操作部署安装手册](docs/操作部署安装手册.md)
- [内置知识库引用列表](docs/内置知识库引用列表.md)

详细产品路线图见 `玄枢八术综合占卜工作台开发计划_v8_完整版.md`。路线图包含尚未实现的规划，判断当前能力时应以 Wiki、测试和源码为准。

## 开源许可证

本项目自有代码采用 [MIT License](LICENSE)。古籍原文、电子转录文本及其他内置语料保留各自独立的来源和许可，不因代码采用 MIT 而改变；使用或再分发时请核对各语料的来源与 license 元数据。第三方依赖遵循各自原有许可证。
