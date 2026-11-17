# DSH BeeAPI Balance

Unofficial [DeepSeek Harness](https://github.com/deepseek-ai) plugin for checking a BeeAPI account balance. The plugin calls the read-only `https://beeapi.dev/v1/usage` endpoint; it does **not** make model inference requests.

## Features

- Compact balance indicator below the conversation composer, with an estimated CNY display at a configurable fixed USD/CNY rate; click the amount to switch between estimated CNY and USD.
- Native balance panel and plugin settings page for a manually entered API key or a supported DSH BeeAPI chat/image channel. Channel reuse stores only a reference and resolves the channel's current key on each query.
- Manual refresh and refresh after normally completed conversation turns (excluding subagent turns). Nearby refreshes using the same key are coalesced within five seconds.
- While visible, the indicator checks local state every 60 seconds and requests an upstream balance refresh every 10 minutes. On returning to a visible tab, it refreshes upstream only if the last balance is stale or missing.

The CNY amount is an **estimate at a fixed rate**, not a live exchange rate or a prediction of actual top-up prices. The plugin does not provide request history or today's spending. BeeAPI's website account endpoints have not been established as accessible with the model API key.

## Install from source

This is a local DSH bundle, not an npm-published package. Clone this repository into an ordinary workspace directory, review `package.json` and `cordis.patch.yml`, then install that directory's **absolute path** with DSH's plugin manager (`install_bundle`). Do not edit the DSH profile's manifest or patch by hand, or run a package manager inside the profile. If the local bundle cannot resolve `@deepseek-ai/schemastery`, install dependencies **in the clone** with `pnpm install --ignore-scripts`; do not run unreviewed install scripts.

On a first install, do not remove any bundle. For an update, check whether `@local/beeapi-dashboard` is already installed, then replace it through the plugin manager as appropriate. Check the install result's `application` and `warnings`; `application: applied` and live registration of the BeeAPI settings page and balance indicator are stronger evidence than a linked package version alone. If installation or activation fails, report the error rather than editing other plugins or bypassing DSH version requirements. Browser UI appearance still needs a separate visual check when browser control is available.

Configure the connection yourself on **Plugins → BeeAPI balance**: select a supported DSH BeeAPI chat/image channel or enter a manual key. Only `https://beeapi.dev` channels are accepted. A manual key is stored by DSH's credential service; channel mode stores a channel reference instead of copying its key. Never paste an API key into an agent prompt, commit it, print it in logs, or put it in environment or credential files in this repository. The local Host sends the key only to BeeAPI for the read-only balance query.

## Development

Run `node --test *.test.js` from the repository root with a compatible Node.js runtime. Tests use synthetic keys and mocked network responses; they do not contact BeeAPI. Browser end-to-end verification is separate from these tests.

## Disclaimer

This is an independent, unofficial plugin and is not affiliated with BeeAPI or the DeepSeek Harness maintainers.

## License

MIT — see [LICENSE](LICENSE).
