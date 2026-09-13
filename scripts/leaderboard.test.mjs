import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { leaderboardCategory, leaderboardDifficulties, leaderboardRegions, validateSubmission } from '../lib/leaderboard.ts';
import { saveScore, readScores, parseCursor } from '../lib/leaderboard-store.ts';

const avatars = JSON.parse(readFileSync(new URL('../lib/avatars.json', import.meta.url), 'utf8'));
const keys = new Set(avatars.map(avatar => avatar.key));
const makeScore = (overrides = {}) => ({ runId: randomUUID(), category: 'kanto', difficulty: 'easy', name: 'Trainer', avatar: '000MS', correct: 100, elapsedMs: 1000, status: 'gave-up', ...overrides });

// Execute the production statements against SQLite with D1's atomic batch semantics.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  }
  return {
    sqlite,
    prepare(sql) { return { bind(...values) { return { sql, values }; } }; },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = statements.map(({ sql, values }) => ({ results: sqlite.prepare(sql).all(...values) }));
        sqlite.exec('COMMIT');
        return result;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

test('only the three cumulative region combinations qualify', () => {
  assert.equal(leaderboardCategory([1]), 'kanto');
  assert.equal(leaderboardCategory([2, 1]), 'kanto-johto');
  assert.equal(leaderboardCategory([3, 1, 2]), 'kanto-johto-hoenn');
  for (const ids of [[], [2], [3], [1, 3], [2, 3], [1, 1]]) assert.equal(leaderboardCategory(ids), null);
});

test('submission validates names, finished status, score bounds, time and avatar', () => {
  assert.equal(validateSubmission(makeScore({ name: '  Ash  ' }), keys).name, 'Ash');
  assert.equal(validateSubmission(makeScore({ correct: 0, elapsedMs: 0 }), keys).correct, 0);
  assert.equal(validateSubmission(makeScore({ name: 'ABCDEFGHIJ' }), keys).name.length, 10);
  for (const overrides of [{ name: '' }, { name: 'ABCDEFGHIJK' }, { name: 'A\nB' }, { correct: -1 }, { correct: 152 }, { correct: 1.5 }, { elapsedMs: -1 }, { elapsedMs: 0.2 }, { correct: 0, elapsedMs: 1 }, { avatar: 'bad' }, { status: 'playing' }, { status: 'complete' }, { category: 'johto' }, { difficulty: 'impossible' }, { runId: '' }]) {
    assert.throws(() => validateSubmission(makeScore(overrides), keys));
  }
  for (const region of leaderboardRegions) for (const difficulty of leaderboardDifficulties) {
    assert.equal(validateSubmission(makeScore({ category: region.id, difficulty: difficulty.id, correct: region.total, status: 'complete' }), keys).correct, region.total);
  }
});

test('all 393 avatars have animation and reduced-motion assets and distinct labels', () => {
  assert.equal(avatars.length, 393); assert.equal(keys.size, 393);
  assert.equal(new Set(avatars.map(avatar => avatar.name)).size, 393);
  assert.equal(avatars[0].key, '000MS');
  for (const avatar of avatars) for (const path of [avatar.animated, avatar.still]) assert.ok(existsSync(new URL('../public' + path, import.meta.url)));
});

test('ranking prioritizes score then time then earlier submissions and IDs', async () => {
  const db = database();
  await saveScore(db, makeScore({ name: 'Slower', elapsedMs: 2000 }), 1);
  await saveScore(db, makeScore({ name: 'Faster' }), 2);
  await saveScore(db, makeScore({ name: 'More', correct: 101, elapsedMs: 5000 }), 3);
  await saveScore(db, makeScore({ name: 'Same' }), 2);
  const page = await readScores(db, 'kanto', 'easy', null);
  assert.deepEqual(page.entries.map(entry => entry.name), ['More', 'Faster', 'Same', 'Slower']);
  assert.deepEqual(page.entries.map(entry => entry.rank), [1, 2, 3, 4]);
  db.sqlite.close();
});

test('999 cutoff, rejection, eviction, safe retries and concurrent qualifying scores', async () => {
  const db = database();
  const insert = db.sqlite.prepare('INSERT INTO leaderboard_entries (run_id, category, difficulty, name, avatar, correct, elapsed_ms, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.sqlite.exec('BEGIN');
  for (let i = 0; i < 998; i++) insert.run(randomUUID(), 'kanto', 'easy', 'Seed', '000MS', 100, 1000, i);
  db.sqlite.exec('COMMIT');
  const edge = makeScore();
  const accepted = await saveScore(db, edge, 1000);
  assert.equal(accepted.rank, 999);
  const rejectedScore = makeScore();
  const rejected = await saveScore(db, rejectedScore, 1001);
  assert.equal(rejected.accepted, false); assert.equal(rejected.entryId, null);
  assert.deepEqual(await saveScore(db, rejectedScore, 1002), rejected);
  const winners = await Promise.all(Array.from({ length: 8 }, () => saveScore(db, makeScore({ correct: 151, status: 'complete' }), 2000)));
  assert.ok(winners.every(result => result.accepted));
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM leaderboard_entries').get().n, 999);
  const retried = await saveScore(db, edge, 3000);
  assert.equal(retried.accepted, true); assert.equal(retried.entryId, null);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE run_id = ?').get(edge.runId).n, 0);
  const unique = makeScore({ category: 'kanto-johto', difficulty: 'hard' });
  const result = await saveScore(db, unique);
  assert.deepEqual(await saveScore(db, unique), result);
  assert.equal(result.rank, 1);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM leaderboard_entries').get().n, 1000);
  // Traverse the entire full board using the production keyset cursor.
  let cursor = null; const entries = [];
  do {
    const page = await readScores(db, 'kanto', 'easy', cursor);
    assert.ok(page.entries.length <= 50); assert.equal(page.total, 999);
    entries.push(...page.entries);
    cursor = parseCursor(page.nextCursor, 'kanto', 'easy');
  } while (cursor);
  assert.equal(entries.length, 999); assert.equal(new Set(entries.map(entry => entry.id)).size, 999);
  assert.equal(entries.at(-1).rank, 999);
  const queryPlan = db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT id FROM leaderboard_entries WHERE category = ? AND difficulty = ? ORDER BY correct DESC, elapsed_ms, submitted_at, id LIMIT 50').all('kanto', 'easy');
  assert.match(JSON.stringify(queryPlan), /idx_leaderboard_ranking/);
  db.sqlite.close();
});

test('cursors cannot cross boards or contain malformed positions', () => {
  assert.throws(() => parseCursor('invalid', 'kanto', 'easy'));
  assert.throws(() => parseCursor(btoa(JSON.stringify({ category: 'kanto', difficulty: 'hard', correct: 10, elapsedMs: 0, submittedAt: 1, id: 1 })), 'kanto', 'easy'));
});
