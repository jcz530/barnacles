PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`description` text,
	`icon` text,
	`last_modified` integer,
	`size` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`preferred_ide` text,
	`preferred_terminal` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "name", "path", "description", "icon", "last_modified", "size", "is_favorite", "archived_at", "preferred_ide", "preferred_terminal", "created_at", "updated_at") SELECT "id", "name", "path", "description", "icon", "last_modified", "size", "is_favorite", "archived_at", "preferred_ide", "preferred_terminal", "created_at", "updated_at" FROM `projects`;
--> statement-breakpoint
DROP TABLE `projects`;
--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);
--> statement-breakpoint
ALTER TABLE `project_stats` ADD `lines_of_code` integer;