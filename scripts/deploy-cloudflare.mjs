import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const configPath = 'dist/server/wrangler.json';
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch {
  console.error('Build the project before deploying: npm run build');
  process.exit(1);
}

const database = config.d1_databases?.find(item => item.binding === 'DB');
const expectedId = process.env.POKEGUESSER_D1_DATABASE_ID;
if (!expectedId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedId) ||
    expectedId === '00000000-0000-4000-8000-000000000000' || database?.database_id !== expectedId) {
  console.error('Set POKEGUESSER_D1_DATABASE_ID to the real D1 database ID and rebuild before deploying.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', configPath,
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
