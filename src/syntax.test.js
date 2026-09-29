import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const sources = readdirSync(new URL('src/', root))
  .filter(name => name.endsWith('.js') && !name.endsWith('.test.js'))
  .map(name => `src/${name}`);

// The browser entry point is not imported by the generator unit tests.
// Parse it (and the other runtime modules) without requiring a browser DOM.
for (const source of ['dev-server.js', ...sources]) {
  test(`${source} has valid JavaScript syntax`, () => {
    const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(source, root))], {
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
