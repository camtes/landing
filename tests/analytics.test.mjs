import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const expected = process.env.ANALYTICS_EXPECTED === 'true';

test('Cloudflare analytics runs only in indexable production builds', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)]
    .map(([script]) => script)
    .filter((script) => script.includes('static.cloudflareinsights.com'));
  assert.equal(scripts.length, expected ? 1 : 0);
  if (!expected) {
    assert.doesNotMatch(html, /data-cf-beacon|10add286a2c74c15b840c6264aec7a84/);
    return;
  }
  assert.match(scripts[0], /type="module"/);
  assert.match(scripts[0], /src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/);
  const beacon = scripts[0].match(/data-cf-beacon="([^"]+)"/)?.[1].replaceAll('&quot;', '"');
  assert.ok(beacon, 'Beacon JSON must remain intact in the emitted script');
  assert.deepEqual(JSON.parse(beacon), { token: '10add286a2c74c15b840c6264aec7a84' });
  assert.match(html, /name="robots" content="index, follow"/);
  assert.ok(html.indexOf(scripts[0]) > html.lastIndexOf('</main>'));
});
