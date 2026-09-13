// Windows-only development binding. Production always uses cloudflare:workers.
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const state = globalThis as typeof globalThis & { __pokeguesserSqlite?: DatabaseSync };
const sqlite = state.__pokeguesserSqlite ??= new DatabaseSync(resolve(process.env.POKEGUESSER_LOCAL_DB || '.cache/leaderboard.sqlite'));
sqlite.exec('PRAGMA busy_timeout = 5000');

type Statement = { sql: string; values: (string | number | null)[] };
const database = {
  prepare(sql: string) {
    return { bind(...values: Statement['values']) { return { sql, values }; } };
  },
  async batch(statements: Statement[]) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(({ sql, values }) => ({ results: sqlite.prepare(sql).all(...values), success: true }));
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
export const env = { DB: database as unknown as D1Database };
