# DSH BeeAPI Balance

Unofficial [DeepSeek Harness](https://github.com/deepseek-ai) plugin for checking a BeeAPI account balance. The plugin calls the read-only `https://beeapi.dev/v1/usage` endpoint; it does **not** make model inference requests.

## Features

- Compact balance indicator below the conversation composer, with an estimated CNY display at a configurable fixed USD/CNY rate; click the amount to switch between estimated CNY and USD.
- Native balance panel and plugin settings page for a manually entered API key or a supported DSH BeeAPI chat/image channel. Channel reuse stores only a reference and resolves the channel's current key on each query.
- Manual refresh and refresh after normally completed conversation turns (excluding subagent turns). Nearby refreshes using the same key are coalesced within five seconds.
- While visible, the indicator checks local state every 60 seconds and requests an upstream balance refresh every 10 minutes. On returning to a visible tab, it refreshes upstream only if the last balance is stale or missing.

The CNY amount is an **estimate at a fixed rate**, not a live exchange rate or a prediction of actual top-up prices. The plugin does not provide request history or today's spending. BeeAPI's website account endpoints have not been established as accessible with the model API key.

## Install and update

The npm distribution is named **`dsh-beeapi-balance`**. It requires DSH `0.2.2-rc.3` or later (currently verified baseline: `0.2.2-rc.3`); future DSH releases still need compatibility testing. Node.js 22 or later is required for development.

After the maintainer publishes the package to npm, install `dsh-beeapi-balance` through DSH's built-in plugin manager. To update, install `dsh-beeapi-balance@latest` through that same manager. This does not promise automatic update checks. Before the first npm publication, use the local-source method below.

### Migrate from the old local bundle

The old package name is `@local/beeapi-dashboard`. Do not enable both packages at once: they share routes and UI registrations. Disable the old bundle through DSH's plugin manager, then install and enable `dsh-beeapi-balance`. Verify the new plugin before optionally removing the old bundle. If migration fails, disable the new bundle and re-enable the old one. Do not edit the DSH profile by hand.

The internal entry/panel IDs, API routes and credential keys are deliberately retained. Existing credential references should remain usable in the same DSH profile, but migration and saved exchange-rate behavior require live verification. Reconnect from the plugin settings if necessary; do not copy secrets into source files.

### Install from source

Clone this repository into an ordinary workspace directory. Review `package.json` and `cordis.patch.yml`, run `pnpm install --ignore-scripts` **in the clone**, then install its **absolute path** through DSH's plugin manager (`install_bundle`). Do not run a package manager inside the DSH profile. Local source installs do not fetch GitHub updates automatically.

Check the install result's `application` and `warnings`; `application: applied` and live registration of the BeeAPI settings page and balance indicator are stronger evidence than an installed version alone. If activation fails, report the diagnostic rather than bypassing DSH version requirements. Browser appearance and an authenticated balance query need separate live checks.

Configure the connection yourself on **Plugins → BeeAPI balance**: select a supported DSH BeeAPI chat/image channel or enter a manual key. Only `https://beeapi.dev` channels are accepted. A manual key is stored by DSH's credential service; channel mode stores a channel reference instead of copying its key. Never paste an API key into an agent prompt, commit it, print it in logs, or put it in environment or credential files in this repository. The local Host sends the key only to BeeAPI for the read-only balance query.

## Development and publishing

Install dependencies with `pnpm install --ignore-scripts`, then run `pnpm test`. Tests use synthetic keys and mocked network responses; they do not contact BeeAPI. Browser end-to-end verification is separate. In restricted environments that prohibit child processes, Node.js 22 or later can run the tests using `node --test --test-isolation=none channels.test.js client.test.js oauth.test.js rate.test.js packaging.test.js`.

This release includes `@deepseek-ai/cosmokit` explicitly to prevent the missing-runtime-dependency error seen in the previous local installation. Published files use a whitelist; tests, lockfiles, node_modules and credential files are not included. There are no install lifecycle scripts. `prepack` runs the test suite before creating a release archive.

See [PUBLISHING.md](PUBLISHING.md) for the maintainer release checklist. Preparing this source does not itself publish anything to npm.

## Disclaimer

This is an independent, unofficial plugin and is not affiliated with BeeAPI or the DeepSeek Harness maintainers.

## License

MIT — see [LICENSE](LICENSE).
