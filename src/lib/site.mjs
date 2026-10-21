export const languages = ['ko', 'en'];
export const sections = ['research', 'cinema', 'writing'];

export function localizedPath(lang, section = '', base = '/') {
  if (!languages.includes(lang)) throw new Error(`Unknown language: ${lang}`);
  if (section && !sections.includes(section)) throw new Error(`Unknown section: ${section}`);
  const prefix = `/${base.split('/').filter(Boolean).join('/')}`.replace(/^\/$/, '');
  return `${prefix}/${lang}/${section ? `${section}/` : ''}`;
}

export function writingPagePath(lang, page, base = '/') {
  return page === 1 ? localizedPath(lang, 'writing', base) : `${localizedPath(lang, 'writing', base)}${page}/`;
}

export function paginate(items, page, perPage = 12) {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) throw new Error('Invalid page');
  return { items: items.slice((page - 1) * perPage, page * perPage), pageCount };
}
