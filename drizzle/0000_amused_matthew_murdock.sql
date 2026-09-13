CREATE TABLE `leaderboard_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`category` text NOT NULL,
	`difficulty` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`correct` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`submitted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_leaderboard_run` ON `leaderboard_entries` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_leaderboard_ranking` ON `leaderboard_entries` (`category`,`difficulty`,"correct" desc,`elapsed_ms`,`submitted_at`,`id`);--> statement-breakpoint
CREATE TABLE `leaderboard_receipts` (
	`run_id` text PRIMARY KEY NOT NULL,
	`accepted` integer NOT NULL
);
