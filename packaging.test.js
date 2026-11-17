import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
test('npm metadata and DSH module identifiers agree', async () => {
  assert.equal(pkg.name, 'dsh-beeapi-balance');
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  const patch = await readFile(new URL(pkg.dsh.bundle.patch, import.meta.url), 'utf8');
  assert.ok(patch.includes(`name: '${pkg.name}'`));
  const client = await readFile(new URL('./client.js', import.meta.url), 'utf8');
  assert.ok(client.includes(`id: '${pkg.name}'`));
  assert.ok(client.includes(`key:'${pkg.name}'`));
  assert.ok(!client.includes('@local/beeapi-dashboard'));
  for (const target of Object.values(pkg.exports)) {
    if (!target.includes('*')) await access(new URL(target, import.meta.url));
  }
  for (const file of ['LICENSE', 'locale/en.json', 'locale/zh.json']) await access(new URL(file, import.meta.url));
  for (const script of ['preinstall', 'install', 'postinstall']) assert.equal(pkg.scripts[script], undefined);
});

test('Host entry imports with declared runtime dependencies', async () => {
  const host = await import('./index.js');
  assert.equal(typeof host.apply, 'function');
  assert.ok(host.Config);
});
