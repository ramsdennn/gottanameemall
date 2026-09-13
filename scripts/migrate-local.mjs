// Apply generated migrations to the Windows preview database, once per migration.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync('.cache', { recursive: true });
const db = new DatabaseSync(resolve(process.env.POKEGUESSER_LOCAL_DB || '.cache/leaderboard.sqlite'));
db.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
for (const name of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) {
  if (db.prepare('SELECT name FROM _local_migrations WHERE name = ?').get(name)) continue;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(readFileSync(resolve('drizzle', name), 'utf8'));
    db.prepare('INSERT INTO _local_migrations (name) VALUES (?)').run(name);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
db.close();
