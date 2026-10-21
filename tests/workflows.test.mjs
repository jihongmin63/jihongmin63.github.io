import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = async (name) => yaml.load(await readFile(join(root, '.github/workflows', name), 'utf8'));

test('main pushes build and deploy the static dist folder to Pages', async () => {
  const deploy = await workflow('deploy.yml');
  assert.deepEqual(deploy.on.push.branches, ['main']);
  assert.equal(deploy.permissions.pages, 'write');
  assert.equal(deploy.permissions['id-token'], 'write');
  const steps = deploy.jobs.build.steps;
  assert.ok(steps.some((step) => step.run?.includes('npm ci')));
  assert.ok(steps.some((step) => step.run?.includes('npm run build')));
  assert.ok(steps.some((step) => step.uses?.startsWith('actions/upload-pages-artifact@') && step.with?.path === 'dist'));
  assert.ok(deploy.jobs.deploy.steps.some((step) => step.uses?.startsWith('actions/deploy-pages@')));
});

test('daily sync uses secrets and deploys the snapshot from the same run', async () => {
  const sync = await workflow('sync-instagram.yml');
  assert.equal(sync.on.schedule.length, 1);
  assert.match(sync.on.schedule[0].cron, /^\d+ \d+ \* \* \*$/);
  assert.ok(sync.on.workflow_dispatch);
  assert.equal(sync.permissions.contents, 'write');
  assert.equal(sync.permissions.pages, 'write');
  assert.equal(sync.permissions['id-token'], 'write');
  const steps = sync.jobs.sync.steps;
  const fetch = steps.find((step) => step.run?.includes('npm run sync:instagram'));
  assert.equal(fetch.env.INSTAGRAM_ACCESS_TOKEN, '${{ secrets.INSTAGRAM_ACCESS_TOKEN }}');
  assert.equal(fetch.env.INSTAGRAM_USER_ID, '${{ secrets.INSTAGRAM_USER_ID }}');
  assert.ok(steps.some((step) => step.run?.includes('git add src/data/instagram.json')));
  assert.ok(steps.some((step) => step.run?.includes('npm run build')));
  assert.ok(steps.some((step) => step.uses?.startsWith('actions/upload-pages-artifact@') && step.with?.path === 'dist'));
  assert.ok(steps.some((step) => step.uses?.startsWith('actions/deploy-pages@')));
  const indexOf = (text) => steps.findIndex((step) => step.run?.includes(text));
  assert.ok(indexOf('npm run sync:instagram') < indexOf('npm test'));
  assert.ok(indexOf('npm test') < indexOf('npm run build'));
  assert.ok(indexOf('npm run build') < indexOf('git add src/data/instagram.json'));
});
