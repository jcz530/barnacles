CREATE TABLE `project_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_count` integer,
	`directory_count` integer,
	`git_branch` text,
	`git_status` text,
	`last_commit_date` integer,
	`last_commit_message` text,
	`has_uncommitted_changes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_technologies` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`technology_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`technology_id`) REFERENCES `technologies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`description` text,
	`last_modified` integer,
	`size` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);
--> statement-breakpoint
CREATE TABLE `technologies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `technologies_name_unique` ON `technologies` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `technologies_slug_unique` ON `technologies` (`slug`);