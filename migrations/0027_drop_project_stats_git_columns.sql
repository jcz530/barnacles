-- Drop the per-checkout git columns from project_stats, now that 0026 has moved
-- them to project_worktrees. This is the second half of the backfill-then-drop
-- pair, mirroring 0014 -> 0015.
--
-- git_remote_url stays: a remote belongs to the repository, not to a checkout.
--
-- git_status is dropped without being carried over. It stored raw
-- `git status --porcelain` output and no component, route, CLI command or MCP
-- tool ever read it -- the UI derives dirtiness from has_uncommitted_changes.

ALTER TABLE `project_stats` DROP COLUMN `git_branch`;--> statement-breakpoint
ALTER TABLE `project_stats` DROP COLUMN `git_status`;--> statement-breakpoint
ALTER TABLE `project_stats` DROP COLUMN `has_uncommitted_changes`;--> statement-breakpoint
ALTER TABLE `project_stats` DROP COLUMN `last_commit_date`;--> statement-breakpoint
ALTER TABLE `project_stats` DROP COLUMN `last_commit_message`;
