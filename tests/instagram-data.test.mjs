import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeInstagramPages, syncInstagram } from '../scripts/instagram-data.mjs';

const media = (id, timestamp = '2026-10-20T01:00:00+0000') => ({
  id,
  caption: `Post ${id}`,
  media_type: 'IMAGE',
  timestamp,
  permalink: `https://www.instagram.com/p/${id}/`,
  media_url: `https://scontent.cdninstagram.com/${id}.jpg`,
});

test('collects every page, removes duplicate posts, and orders newest first', async () => {
  const posts = await normalizeInstagramPages(async (url) => url.endsWith('after=next')
    ? { data: [media('new', '2026-10-21T01:00:00+0000'), media('old')] }
    : { data: [media('old')], paging: { next: 'https://graph.instagram.com/v25.0/123/media?after=next' } },
  'https://graph.instagram.com/v25.0/123/media');
  assert.deepEqual(posts.map(({ id }) => id), ['new', 'old']);
  assert.equal(posts[0].previewUrl, 'https://scontent.cdninstagram.com/new.jpg');
});

test('rejects malformed pages and non-Instagram permalinks', async () => {
  await assert.rejects(normalizeInstagramPages(async () => ({ data: {} }), 'https://graph.instagram.com/v25.0/me/media'), /data/i);
  await assert.rejects(normalizeInstagramPages(async () => ({ data: [{ ...media('bad'), permalink: 'javascript:alert(1)' }] }), 'https://graph.instagram.com/v25.0/me/media'), /permalink/i);
});

test('a later page failure preserves the last successful snapshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'instagram-'));
  const outputPath = join(dir, 'instagram.json');
  try {
    await writeFile(outputPath, '[{"id":"previous"}]\n');
    const fetchImpl = async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer secret-token');
      assert.equal(url.includes('secret-token'), false);
      if (url.includes('fields=id,username')) return { ok: true, json: async () => ({ id: '123', username: 'themenostalgia' }) };
      if (url.includes('after=next')) return { ok: false, status: 503 };
      return { ok: true, json: async () => ({ data: [media('one')], paging: { next: 'https://graph.instagram.com/v25.0/123/media?after=next' } }) };
    };
    await assert.rejects(syncInstagram({ token: 'secret-token', userId: '123', fetchImpl, outputPath }), /503/);
    assert.equal(await readFile(outputPath, 'utf8'), '[{"id":"previous"}]\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('refuses a token for a different account', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ id: '123', username: 'someoneelse' }) });
  await assert.rejects(syncInstagram({ token: 'secret-token', userId: '123', fetchImpl, outputPath: 'unused.json' }), /themenostalgia/i);
});
