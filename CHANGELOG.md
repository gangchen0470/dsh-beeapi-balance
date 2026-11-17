# 更新日志

## 1.2.10 — 2026-11-17（预发布）

- GitHub Release：https://github.com/gangchen0470/dsh-beeapi-balance/releases/tag/v1.2.10
- 候选源码分支：`release/npm-v1.2.10`
- 候选提交：`96fa2012e34c053339af8c37a22858255d5d3742`
- 状态：已发布 GitHub Pre-release，尚未发布 npm；这些候选代码尚未合并 main。

### 发布准备

- npm 包名从 `@local/beeapi-dashboard` 调整为 `dsh-beeapi-balance`，版本为 1.2.10。
- 同步 Cordis 包名、客户端模块、语言命名空间和设置页注册。
- 保留内部 entry/panel ID、凭据键和 API 路由，减少迁移影响。
- 补齐 MIT 许可证字段、仓库链接、公共 npm 发布配置和发布文件白名单。
- 显式加入 `@deepseek-ai/cosmokit` 运行依赖，修复此前本地加载缺失依赖的问题。
- 添加打包一致性检查、prepack 测试、发布及旧包迁移说明。
- 声明 Node.js >=22、DSH >=0.2.2-rc.3；仅以当时安装的 DSH 0.2.2-rc.3 为基线，不代表其他版本均已验证。

### 验证记录

- 正常 prepack 流程下 28 项测试通过，打包成功。
- tgz 含 12 个运行及说明文件，不含 node_modules、凭据、缓存或测试文件。
- 独立项目安装 tgz 成功；hoisted 依赖布局下 Host 入口加载通过。
- 本机默认 pnpm 链接布局仍报 `ERR_MODULE_NOT_FOUND`（`@deepseek-ai/schemastery`），尚未确认根因；不能宣称默认布局已兼容。
- 新 npm 身份尚未完成 DSH 实际启用、界面、真实余额查询、旧包迁移及汇率持久化验收。
- 原本运行中的本地包未被替换。

### 附件

Release 包含 `dsh-beeapi-balance-1.2.10.tgz` 和 `dsh-beeapi-balance-1.2.10-source.tar.gz`。GitHub 发布不等于 npm 发布，尚不能依赖 npm 包名在线安装本候选版。

## 1.2.9 — 本次整理前的基线

- 原主分支提交：`b68eaa45061c4bcd3b51662914221f3c07c27e1a`。
- 使用本地私有包名 `@local/beeapi-dashboard`，通过 DSH 插件管理器安装绝对目录。
- 本机曾因 `@deepseek-ai/cosmokit` 缺失导致启用失败；补装依赖后管理器返回 `application: applied`、无警告。
- 此处仅记录本次维护中核实的状态，不补造更早版本历史。
