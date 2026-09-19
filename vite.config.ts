import vinext from 'vinext';
import { defineConfig } from 'vite';
import { sites } from './build/sites-vite-plugin';
import hosting from './.openai/hosting.json';
import { fileURLToPath } from 'node:url';

export default defineConfig(async ({ command }) => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  const productionDatabaseId = process.env.POKEGUESSER_D1_DATABASE_ID;
  const windowsPreview = command === 'serve' && process.platform === 'win32';
  return {
    resolve: windowsPreview ? { alias: { 'cloudflare:workers': fileURLToPath(new URL('./build/local-workers.ts', import.meta.url)) } } : undefined,
    plugins: [vinext(), sites({ mockAuth: false }), !windowsPreview && cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      inspectorPort: false,
      config: {
        main: 'vinext/server/fetch-handler',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: hosting.d1 ? [{ binding: hosting.d1, database_name: 'pokeguesser', database_id: productionDatabaseId || '00000000-0000-4000-8000-000000000000' }] : [],
        workers_dev: true,
        routes: productionDatabaseId ? [
          { pattern: 'gottanameemall.co.uk', custom_domain: true },
          { pattern: 'www.gottanameemall.co.uk', custom_domain: true },
        ] : [],
      },
    })],
    server: { host: '127.0.0.1', watch: { ignored: ['**/outputs/**'] } },
  };
});
