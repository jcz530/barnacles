CREATE TABLE `project_worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`branch` text,
	`is_main` integer DEFAULT false NOT NULL,
	`git_dir` text,
	`has_uncommitted_changes` integer,
	`last_commit_date` integer,
	`last_commit_message` text,
	`preferred_ide` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_worktrees_path_unique` ON `project_worktrees` (`path`);