import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

const graphOrigin = 'https://graph.instagram.com';
const fields = 'id,caption,media_type,timestamp,permalink,media_url,thumbnail_url';

function graphUrl(value) {
  const url = new URL(value);
  if (url.origin !== graphOrigin) throw new Error('Invalid Instagram pagination URL');
  url.searchParams.delete('access_token');
  return url.href;
}

function httpsUrl(value, field, allowedHost) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Instagram ${field}`);
  }
  if (url.protocol !== 'https:' || (allowedHost && !allowedHost.includes(url.hostname))) {
    throw new Error(`Invalid Instagram ${field}`);
  }
  return url.href;
}

export async function normalizeInstagramPages(fetchPage, startUrl) {
  const posts = [];
  const seenPosts = new Set();
  const seenPages = new Set();
  let next = graphUrl(startUrl);
  while (next) {
    if (seenPages.has(next) || seenPages.size >= 500) throw new Error('Instagram pagination did not finish');
    seenPages.add(next);
    const page = await fetchPage(next);
    if (!page || !Array.isArray(page.data)) throw new Error('Invalid Instagram data page');
    for (const item of page.data) {
      if (!item || typeof item.id !== 'string' || !item.id || typeof item.media_type !== 'string' || typeof item.timestamp !== 'string' || Number.isNaN(Date.parse(item.timestamp))) {
        throw new Error('Invalid Instagram media item');
      }
      if (seenPosts.has(item.id)) continue;
      const permalink = httpsUrl(item.permalink, 'permalink', ['instagram.com', 'www.instagram.com']);
      const preview = item.media_type === 'VIDEO' ? item.thumbnail_url || item.media_url : item.media_url || item.thumbnail_url;
      posts.push({
        id: item.id,
        caption: typeof item.caption === 'string' ? item.caption : '',
        mediaType: item.media_type,
        timestamp: item.timestamp,
        permalink,
        previewUrl: preview ? httpsUrl(preview, 'preview URL') : null,
      });
      seenPosts.add(item.id);
    }
    if (page.paging?.next !== undefined && typeof page.paging.next !== 'string') throw new Error('Invalid Instagram pagination URL');
    next = page.paging?.next ? graphUrl(page.paging.next) : null;
  }
  return posts.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function syncInstagram({ token, userId, fetchImpl = fetch, outputPath }) {
  if (!token || !userId || !/^\d+$/.test(userId)) throw new Error('Instagram token and numeric user ID are required');
  const request = async (url) => {
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Instagram API request failed (${response.status})`);
    return response.json();
  };
  const version = process.env.INSTAGRAM_API_VERSION || 'v25.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('Invalid Instagram API version');
  const profile = await request(`${graphOrigin}/${version}/${userId}?fields=id,username`);
  if (String(profile.id) !== userId || String(profile.username).toLowerCase() !== 'themenostalgia') {
    throw new Error('Instagram token or user ID does not match themenostalgia');
  }
  const url = new URL(`${graphOrigin}/${version}/${userId}/media`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '100');
  const posts = await normalizeInstagramPages(request, url.href);
  await mkdir(dirname(outputPath), { recursive: true });
  const temporary = join(dirname(outputPath), `.${basename(outputPath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
    await rename(temporary, outputPath);
  } finally {
    await rm(temporary, { force: true });
  }
  return posts.length;
}
