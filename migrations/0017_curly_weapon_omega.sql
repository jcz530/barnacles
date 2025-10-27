PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_aliases` (
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
--> statement-breakpoint
INSERT INTO `__new_aliases`("id", "name", "command", "description", "color", "show_command", "category", "order", "created_at", "updated_at") SELECT "id", "name", "command", "description", "color", "show_command", "category", "order", "created_at", "updated_at" FROM `aliases`;--> statement-breakpoint
DROP TABLE `aliases`;--> statement-breakpoint
ALTER TABLE `__new_aliases` RENAME TO `aliases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;