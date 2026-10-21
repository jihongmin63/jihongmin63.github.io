import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = (path) => readFile(join(root, 'dist', path, 'index.html'), 'utf8');
const moviesPath = join(root, 'src/data/movies.json');
const postsPath = join(root, 'src/data/instagram.json');

function buildSite() {
  const astroCli = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
  const result = spawnSync(process.execPath, [astroCli, 'build'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

test('localized paths retain the configured deployment base', async () => {
  const { localizedPath } = await import('../src/lib/site.mjs');
  assert.equal(localizedPath('en', 'cinema', '/portfolio/'), '/portfolio/en/cinema/');
  assert.equal(localizedPath('ko', '', '/portfolio/'), '/portfolio/ko/');
});

test('static build produces the card and all three pages in both languages', async () => {
  buildSite();
  for (const lang of ['ko', 'en']) {
    for (const section of ['', 'research', 'cinema', 'writing']) {
      const html = await page(join(lang, section));
      assert.match(html, new RegExp(`<html[^>]+lang="${lang}"`));
    }
  }
  assert.match(await page(''), /ko\//);
});

test('home shows only the card and language switch outside its card content', async () => {
  for (const [lang, other] of [['ko', 'en'], ['en', 'ko']]) {
    const html = await page(lang);
    assert.match(html, /data-flip-card/);
    assert.match(html, /<button[^>]+data-flip-button/);
    assert.match(html, new RegExp(`href="/${other}/"`));
    assert.match(html, new RegExp(`href="/${lang}/research/"`));
    assert.match(html, /Jihong_Min_CV_2026_\.pdf/);
    assert.doesNotMatch(html, /class="(?:main-nav|wordmark|home-intro|home-sections|site-footer|card-labels)"/);
  }
  assert.doesNotMatch(await page('ko/research'), /class="main-nav"/);
});

test('cinema reflects the current movie snapshot', async () => {
  const html = await page('ko/cinema');
  const movies = JSON.parse(await readFile(moviesPath, 'utf8'));
  assert.ok(html.includes(`${movies.length} 편`));
  if (movies.length) assert.ok(html.includes(movies[0].url));
  assert.equal((html.match(/class="movie-review"/g) || []).length, movies.filter((movie) => movie.review && !movie.spoiler).length);
  assert.equal((html.match(/class="spoiler-review"/g) || []).length, movies.filter((movie) => movie.review && movie.spoiler).length);
});

test('writing page reflects the current Instagram snapshot', async () => {
  const html = await page('ko/writing');
  const posts = JSON.parse(await readFile(postsPath, 'utf8'));
  assert.match(html, /https:\/\/www\.instagram\.com\/themenostalgia\//);
  if (posts.length) {
    assert.doesNotMatch(html, /게시물 연결 전/);
    assert.ok(html.includes(posts[0].permalink));
    assert.equal((html.match(/class="post-card"/g) || []).length, Math.min(12, posts.length));
  } else {
    assert.match(html, /게시물 연결 전/);
    assert.equal((html.match(/class="post-card"/g) || []).length, 0);
  }
});

test('empty and populated content snapshots render without changing the checked-in data', async () => {
  const originalMovies = await readFile(moviesPath, 'utf8');
  const originalPosts = await readFile(postsPath, 'utf8');
  try {
    await writeFile(moviesPath, '[]\n');
    await writeFile(postsPath, '[]\n');
    buildSite();
    assert.match(await page('ko/writing'), /게시물 연결 전/);
    assert.match(await page('ko/cinema'), /0 편/);

    await writeFile(moviesPath, JSON.stringify([{ id: 'fixture', url: 'https://pedia.watcha.com/ko-KR/contents/fixture', title: 'Fixture film', year: 2026, rating: 4, review: 'A <turn> & more', spoiler: true, watchedAt: null }]));
    await writeFile(postsPath, JSON.stringify([{ id: 'fixture', caption: 'Fixture post', mediaType: 'IMAGE', timestamp: '2026-10-21T00:00:00+0000', permalink: 'https://www.instagram.com/p/fixture/', previewUrl: null }]));
    buildSite();
    const cinema = await page('ko/cinema');
    assert.match(cinema, /<details class="spoiler-review">/);
    assert.match(cinema, /A &lt;turn&gt; &amp; more/);
    const writing = await page('ko/writing');
    assert.match(writing, /https:\/\/www\.instagram\.com\/p\/fixture\//);
    assert.doesNotMatch(writing, /게시물 연결 전/);
  } finally {
    await writeFile(moviesPath, originalMovies);
    await writeFile(postsPath, originalPosts);
    buildSite();
  }
});
