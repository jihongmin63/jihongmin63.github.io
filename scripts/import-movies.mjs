import { importMovieFile } from './movie-data.mjs';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/import-movies.mjs <source.csv>');
  process.exitCode = 1;
} else {
  try {
    const count = await importMovieFile(source, 'src/data/movies.json');
    console.log(`Imported ${count} films.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
