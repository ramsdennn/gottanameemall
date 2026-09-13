import type { Difficulty } from './game';
import type { LeaderboardEntry, LeaderboardPage, RegionCategory, ScoreSubmission, SubmissionResult } from './leaderboard';

export const rankingOrder = 'correct DESC, elapsed_ms ASC, submitted_at ASC, id ASC';
const columns = 'id, name, avatar, correct, elapsed_ms AS elapsedMs, submitted_at AS submittedAt';
const ahead = `(other.correct > entry.correct OR (other.correct = entry.correct AND
  (other.elapsed_ms < entry.elapsed_ms OR (other.elapsed_ms = entry.elapsed_ms AND
  (other.submitted_at < entry.submitted_at OR (other.submitted_at = entry.submitted_at AND other.id < entry.id))))))`;
const rankQuery = `(SELECT COUNT(*) + 1 FROM leaderboard_entries other WHERE other.category = entry.category AND other.difficulty = entry.difficulty AND ${ahead})`;

export async function saveScore(db: D1Database, score: ScoreSubmission, now = Date.now()): Promise<SubmissionResult> {
  // D1 batch is one serializable transaction: insert, decide, prune, then return.
  // A receipt survives eviction, so an old retry cannot re-enter the board.
  const statements = [
    db.prepare(`INSERT INTO leaderboard_entries (run_id, category, difficulty, name, avatar, correct, elapsed_ms, submitted_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM leaderboard_receipts WHERE run_id = ?)`)
      .bind(score.runId, score.category, score.difficulty, score.name, score.avatar, score.correct, score.elapsedMs, now, score.runId),
    db.prepare(`INSERT INTO leaderboard_receipts (run_id, accepted)
      SELECT ?, CASE WHEN ${rankQuery} <= 999 THEN 1 ELSE 0 END FROM leaderboard_entries entry
      WHERE entry.run_id = ? AND NOT EXISTS (SELECT 1 FROM leaderboard_receipts WHERE run_id = ?)`)
      .bind(score.runId, score.runId, score.runId),
    db.prepare(`DELETE FROM leaderboard_entries WHERE id IN
      (SELECT id FROM leaderboard_entries WHERE category = ? AND difficulty = ? ORDER BY ${rankingOrder} LIMIT -1 OFFSET 999)`)
      .bind(score.category, score.difficulty),
    db.prepare(`SELECT receipt.accepted, entry.id AS entryId, CASE WHEN entry.id IS NULL THEN NULL ELSE ${rankQuery} END AS rank
      FROM leaderboard_receipts receipt LEFT JOIN leaderboard_entries entry ON entry.run_id = receipt.run_id WHERE receipt.run_id = ?`)
      .bind(score.runId),
  ];
  const result = await db.batch(statements);
  const row = result[3].results[0] as { accepted: number; entryId: number | null; rank: number | null } | undefined;
  if (!row) throw new Error('Submission could not be saved.');
  return { ...row, accepted: row.accepted === 1 };
}

type Cursor = { category: RegionCategory; difficulty: Difficulty; correct: number; elapsedMs: number; submittedAt: number; id: number };
export function parseCursor(cursor: string | null, category: RegionCategory, difficulty: Difficulty): Cursor | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(atob(cursor)) as Cursor;
    if (value.category !== category || value.difficulty !== difficulty || ![value.correct, value.elapsedMs, value.submittedAt, value.id].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error();
    return value;
  } catch { throw new Error('Invalid leaderboard position.'); }
}

export async function readScores(db: D1Database, category: RegionCategory, difficulty: Difficulty, cursor: Cursor | null): Promise<LeaderboardPage> {
  const after = cursor ? 'WHERE (correct < ? OR (correct = ? AND (elapsedMs > ? OR (elapsedMs = ? AND (submittedAt > ? OR (submittedAt = ? AND id > ?))))))' : '';
  const query = db.prepare(`WITH ranked AS (SELECT ${columns}, ROW_NUMBER() OVER (ORDER BY ${rankingOrder}) AS rank
    FROM leaderboard_entries WHERE category = ? AND difficulty = ?)
    SELECT * FROM ranked ${after} ORDER BY rank LIMIT 51`);
  const values = cursor ? [cursor.correct, cursor.correct, cursor.elapsedMs, cursor.elapsedMs, cursor.submittedAt, cursor.submittedAt, cursor.id] : [];
  const results = await db.batch([
    query.bind(category, difficulty, ...values),
    db.prepare('SELECT COUNT(*) AS total FROM leaderboard_entries WHERE category = ? AND difficulty = ?').bind(category, difficulty),
  ]);
  const entries = results[0].results.slice(0, 50) as LeaderboardEntry[];
  const last = entries.at(-1);
  return {
    entries,
    total: Number((results[1].results[0] as { total: number }).total),
    nextCursor: results[0].results.length > 50 && last ? btoa(JSON.stringify({ category, difficulty, correct: last.correct, elapsedMs: last.elapsedMs, submittedAt: last.submittedAt, id: last.id })) : null,
  };
}
