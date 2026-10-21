import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseMovieCsv, importMovieFile } from '../scripts/movie-data.mjs';

const header = 'ID,URL,Title,Type,Year,Directors,WatchedAt,Rating,Review,Spoiler,';
const row = (id, date, review = '', type = 'MOVIE', rating = '4', spoiler = '') =>
  `"${id}","https://pedia.watcha.com/ko-KR/contents/${id}","Film ${id}","${type}","2024","","${date}","${rating}","${review}","${spoiler}"`;

test('parses quoted comma and newline in reviews and preserves source text', () => {
  const csv = `${header}\n${row('a', '2025-06-01', '좋아,\n다시 보자')}\n`;
  assert.equal(parseMovieCsv(csv)[0].review, '좋아,\n다시 보자');
});

test('filters TV, deduplicates IDs, and puts unknown dates after real dates', () => {
  const csv = [header, row('old', '1970-01-01'), row('tv', '2026-01-01', '', 'TV'), row('new', '2025-06-01', '', 'MOVIE', '4.5', 'true'), row('old', '2026-01-01')].join('\n');
  const movies = parseMovieCsv(csv);
  assert.deepEqual(movies.map(({ id }) => id), ['new', 'old']);
  assert.equal(movies[0].rating, 4.5);
  assert.equal(movies[0].spoiler, true);
  assert.equal(movies[1].watchedAt, null);
});

test('rejects missing columns and invalid rating or URL', () => {
  assert.throws(() => parseMovieCsv('ID,Title\na,Film'), /missing.*URL/i);
  assert.throws(() => parseMovieCsv(`${header}\n${row('a', '', '', 'MOVIE', '4.3')}`), /rating/i);
  assert.throws(() => parseMovieCsv(`${header}\n${row('a', '', '', 'MOVIE', '4').replace('https://pedia.watcha.com/ko-KR/contents/a', 'javascript:alert(1)')}`), /URL/i);
});

test('invalid source leaves previous snapshot untouched', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'movies-'));
  const input = join(dir, 'input.csv');
  const output = join(dir, 'movies.json');
  try {
    await writeFile(output, '[{"id":"previous"}]\n');
    await writeFile(input, `${header}\n${row('a', '', '', 'MOVIE', '9')}`);
    await assert.rejects(importMovieFile(input, output), /rating/i);
    assert.equal(await readFile(output, 'utf8'), '[{"id":"previous"}]\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
