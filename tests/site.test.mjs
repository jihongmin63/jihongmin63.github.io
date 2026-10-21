import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = (path) => readFile(join(root, 'dist', path, 'index.html'), 'utf8');

test('localized paths retain the configured deployment base', async () => {
  const { localizedPath } = await import('../src/lib/site.mjs');
  assert.equal(localizedPath('en', 'cinema', '/portfolio/'), '/portfolio/en/cinema/');
  assert.equal(localizedPath('ko', '', '/portfolio/'), '/portfolio/ko/');
});

test('static build produces the card and all three pages in both languages', async () => {
  const astroCli = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
  const result = spawnSync(process.execPath, [astroCli, 'build'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const lang of ['ko', 'en']) {
    for (const section of ['', 'research', 'cinema', 'writing']) {
      const html = await page(join(lang, section));
      assert.match(html, new RegExp(`<html[^>]+lang="${lang}"`));
    }
  }
  assert.match(await page(''), /ko\//);
});

test('card offers a keyboard button, links, and a matching language switch', async () => {
  const html = await page('ko');
  assert.match(html, /data-flip-card/);
  assert.match(html, /<button[^>]+data-flip-button/);
  assert.match(html, /href="\/en\/"/);
  assert.match(html, /href="\/ko\/research\/"/);
  assert.match(html, /Jihong_Min_CV_2026_\.pdf/);
});

test('cinema contains imported reviews and film links', async () => {
  const html = await page('ko/cinema');
  const movies = JSON.parse(await readFile(join(root, 'src/data/movies.json'), 'utf8'));
  const reviewed = movies.find((movie) => movie.review);
  assert.ok(reviewed);
  assert.ok(html.includes(reviewed.url));
  assert.ok(html.includes(reviewed.review));
  assert.match(html, /260/);
});

test('writing page links to the account while first sync is pending', async () => {
  const html = await page('ko/writing');
  assert.match(html, /https:\/\/www\.instagram\.com\/themenostalgia\//);
  assert.match(html, /연결 전/);
  assert.doesNotMatch(html, /Post 01|Lorem ipsum/);
});
