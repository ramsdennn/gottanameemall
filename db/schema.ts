import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const leaderboardEntries = sqliteTable('leaderboard_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(),
  category: text('category').notNull(),
  difficulty: text('difficulty').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
  correct: integer('correct').notNull(),
  elapsedMs: integer('elapsed_ms').notNull(),
  submittedAt: integer('submitted_at').notNull(),
}, table => [
  uniqueIndex('idx_leaderboard_run').on(table.runId),
  index('idx_leaderboard_ranking').on(table.category, table.difficulty, sql`${table.correct} desc`, table.elapsedMs, table.submittedAt, table.id),
]);

// Receipts retain only the idempotency decision, never a displaced score or name.
export const leaderboardReceipts = sqliteTable('leaderboard_receipts', {
  runId: text('run_id').primaryKey(),
  accepted: integer('accepted').notNull(),
});
