import { readFile, rename, rm, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const required = ['ID', 'URL', 'Title', 'Type', 'Year', 'WatchedAt', 'Rating', 'Review', 'Spoiler'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        field += char;
      }
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(field);
      field = '';
      afterQuote = false;
      if (char !== ',') {
        if (row.some((value) => value !== '')) rows.push(row);
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i += 1;
      }
    } else if (char === '"' && field === '' && !afterQuote) {
      quoted = true;
    } else if (afterQuote || char === '"') {
      throw new Error(`Invalid CSV quoting near character ${i}`);
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function validDate(value, rowNumber) {
  if (!value || value === '1970-01-01') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid WatchedAt on row ${rowNumber}`);
  }
  return value;
}

export function parseMovieCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('Missing CSV header');
  const headers = rows[0];
  for (const name of required) {
    if (!headers.includes(name)) throw new Error(`Missing required column: ${name}`);
  }
  const minimumCells = Math.max(...required.map((name) => headers.indexOf(name))) + 1;
  const seen = new Set();
  const movies = [];
  for (const [index, cells] of rows.slice(1).entries()) {
    if (cells.length < minimumCells) throw new Error(`Missing cells on row ${index + 2}`);
    const source = Object.fromEntries(headers.map((name, column) => [name, cells[column] ?? '']));
    if (source.Type !== 'MOVIE') continue;
    const rowNumber = index + 2;
    const id = source.ID.trim();
    if (!id) throw new Error(`Missing ID on row ${rowNumber}`);
    if (seen.has(id)) continue;
    const title = source.Title.trim();
    if (!title) throw new Error(`Missing Title on row ${rowNumber}`);
    let url;
    try {
      url = new URL(source.URL);
    } catch {
      throw new Error(`Invalid URL on row ${rowNumber}`);
    }
    if (url.protocol !== 'https:' || url.hostname !== 'pedia.watcha.com') throw new Error(`Invalid URL on row ${rowNumber}`);
    const year = Number(source.Year);
    if (!Number.isInteger(year) || year < 1800 || year > 2100) throw new Error(`Invalid Year on row ${rowNumber}`);
    const rating = Number(source.Rating);
    if (!Number.isFinite(rating) || rating < 0.5 || rating > 5 || rating * 2 !== Math.round(rating * 2)) {
      throw new Error(`Invalid Rating on row ${rowNumber}`);
    }
    const spoilerText = source.Spoiler.trim().toLowerCase();
    if (!['', 'true', 'false'].includes(spoilerText)) throw new Error(`Invalid Spoiler on row ${rowNumber}`);
    movies.push({
      id,
      url: url.href,
      title,
      year,
      rating,
      review: source.Review.trim(),
      spoiler: spoilerText === 'true',
      watchedAt: validDate(source.WatchedAt.trim(), rowNumber),
    });
    seen.add(id);
  }
  return movies.sort((a, b) => {
    if (a.watchedAt && b.watchedAt) return b.watchedAt.localeCompare(a.watchedAt);
    return Number(Boolean(b.watchedAt)) - Number(Boolean(a.watchedAt));
  });
}

export async function importMovieFile(sourcePath, targetPath) {
  const movies = parseMovieCsv(await readFile(sourcePath, 'utf8'));
  await mkdir(dirname(targetPath), { recursive: true });
  const temporary = join(dirname(targetPath), `.${basename(targetPath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(movies, null, 2)}\n`, 'utf8');
    await rename(temporary, targetPath);
  } finally {
    await rm(temporary, { force: true });
  }
  return movies.length;
}
