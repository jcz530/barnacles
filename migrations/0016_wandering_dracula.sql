CREATE TABLE `alias_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`git_color` text DEFAULT '32' NOT NULL,
	`docker_color` text DEFAULT '34' NOT NULL,
	`system_color` text DEFAULT '33' NOT NULL,
	`custom_color` text DEFAULT '36' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alias_themes_name_unique` ON `alias_themes` (`name`);--> statement-breakpoint
CREATE TABLE `aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`description` text,
	`color` text,
	`show_command` integer DEFAULT true NOT NULL,
	`category` text DEFAULT 'custom' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);