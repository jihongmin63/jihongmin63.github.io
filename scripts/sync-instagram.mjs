import { syncInstagram } from './instagram-data.mjs';

try {
  const count = await syncInstagram({
    token: process.env.INSTAGRAM_ACCESS_TOKEN,
    userId: process.env.INSTAGRAM_USER_ID,
    outputPath: 'src/data/instagram.json',
  });
  console.log(`Synced ${count} Instagram posts.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
