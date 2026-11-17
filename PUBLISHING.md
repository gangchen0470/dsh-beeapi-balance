# npm 发布清单

目标包：`dsh-beeapi-balance@1.2.10`，公共源： https://registry.npmjs.org/ 。名称查询曾返回 404，但名称可用性、账号权限以真正发布时为准。

## 发布前

1. 将本目录的源码变更合并回 GitHub 仓库；不要提交 node_modules、.npmrc、Token、API Key 或打包缓存。
2. 使用 Node.js >=22，运行 `pnpm install --ignore-scripts` 和 `pnpm test`。
3. 运行 `npm pack --dry-run` 检查白名单，再运行 `npm pack`。prepack 会执行测试；不要忽略测试失败。受限沙箱可单独用 README 的无子进程测试命令检查，但正式发布应运行正常 prepack。
4. 在干净的临时项目安装 tarball，检查 `import('dsh-beeapi-balance')` 能成功。
5. 在独立 DSH 测试配置中通过插件管理器安装 tarball。检查 application=applied、无警告、设置页、余额栏、手动刷新、渠道复用及旧包迁移。不要同时启用 @local/beeapi-dashboard 和新包。
6. 当前兼容性声明以 DSH 0.2.2-rc.3 为最低基线；发布前完成实际 DSH 安装和浏览器验收。新的 npm 身份尚未经过此项验收时不要宣称已全部验证。

## 发布（由维护者在本机操作）

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view dsh-beeapi-balance@1.2.10 version dist.integrity --registry=https://registry.npmjs.org/
```

按 npm 的要求完成账号验证和 2FA。不要把密码、OTP 或 Token 发给 AI，也不要把认证内容写进仓库。CI 发布建议使用 npm 官方 trusted publishing，具体认证要求以 npm 当前文档为准。

完成后提交源码并创建对应版本标签。npm 已发布版本不可覆盖；后续修改递增 package.json 的版本号后重新测试、打包与发布。若包名被占用，选择有权限的 scope，并同步 package.json、cordis.patch.yml、client.js 和测试中的包身份。

## 用户安装和更新

发布成功后，在 DSH 内置插件管理器中安装 `dsh-beeapi-balance`，更新时安装 `dsh-beeapi-balance@latest`。从旧本地包迁移须先禁用旧包，再启用新包；验证成功后才考虑移除旧包。
