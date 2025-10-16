CREATE TABLE `project_language_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`technology_slug` text NOT NULL,
	`file_count` integer NOT NULL,
	`percentage` integer NOT NULL,
	`lines_of_code` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Note: Data migration from language_stats JSON column to project_language_stats table
-- will be handled by the application code on the next scan/rescan of projects.
-- The JSON column contained: { techSlug: { fileCount: number, percentage: number, linesOfCode: number } }
--> statement-breakpoint
ALTER TABLE `project_stats` DROP COLUMN `language_stats`;