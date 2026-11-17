# Release validation — 1.2.10

- Prepared locally; NOT published to npm and NOT pushed to GitHub.
- Existing running @local/beeapi-dashboard installation left unchanged.
- 28 tests passed with the normal prepack command after approved child-process access.
- pnpm pack succeeded; tarball contains 12 files: runtime JS, manifest, patch, icon, locales, README and MIT license. No node_modules, credentials, test files or caches are shipped.
- Independent tarball install succeeded. Import failed with this machine's default pnpm linked layout (ERR_MODULE_NOT_FOUND: @deepseek-ai/schemastery); reinstall with node-linker=hoisted succeeded and exported apply loaded correctly. Default linked-layout compatibility remains unresolved and must not be represented as verified.
- New npm identity has NOT been enabled in DSH or visually tested. Live DSH install/migration and real balance query remain release acceptance steps.
- Registry lookup returned 404 for dsh-beeapi-balance during preparation; this does not reserve the name or establish publish permission.
- Minimum DSH baseline set to the installed 0.2.2-rc.3; broader version compatibility not verified.
