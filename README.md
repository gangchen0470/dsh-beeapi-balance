# DSH BeeAPI Balance

Unofficial [DeepSeek Harness](https://github.com/deepseek-ai) plugin for checking a BeeAPI account balance. The plugin calls the read-only `https://beeapi.dev/v1/usage` endpoint; it does **not** make model inference requests.

## Features

- Compact balance indicator below the conversation composer, with an estimated CNY display at a configurable fixed USD/CNY rate; click the amount to switch between estimated CNY and USD.
- Native balance panel and plugin settings page for a manually entered API key or a supported DSH BeeAPI chat/image channel. Channel reuse stores only a reference and resolves the channel's current key on each query.
- Manual refresh and refresh after normally completed conversation turns (excluding subagent turns). Nearby refreshes using the same key are coalesced within five seconds.
- While visible, the indicator checks local state every 60 seconds and requests an upstream balance refresh every 10 minutes. On returning to a visible tab, it refreshes upstream only if the last balance is stale or missing.

The CNY amount is an **estimate at a fixed rate**, not a live exchange rate or a prediction of actual top-up prices. The plugin does not provide request history or today's spending. BeeAPI's website account endpoints have not been established as accessible with the model API key.

## Install from source

This is a local DSH bundle rather than an npm-published package. Clone it and use DSH's plugin manager to install the local directory. The bundle manifest is `package.json` and the Loader patch is `cordis.patch.yml`. Install dependencies with `pnpm install --ignore-scripts` if your local bundle loader does not resolve `@deepseek-ai/schemastery` automatically. Configure the connection on the **Plugins → BeeAPI balance** page.

Only `https://beeapi.dev` channels are accepted. A manual key is stored by DSH's credential service; channel mode stores a channel reference instead of copying its key. Do not commit real keys, environment files, or local credential documents. The extension sends the key only from the local Host to BeeAPI for the balance query.

## Development

Run `node --test *.test.js` from the repository root with a compatible Node.js runtime. Tests use synthetic keys and mocked network responses; they do not contact BeeAPI. Browser end-to-end verification is separate from these tests.

## Disclaimer

This is an independent, unofficial plugin and is not affiliated with BeeAPI or the DeepSeek Harness maintainers.

## License

MIT — see [LICENSE](LICENSE).
