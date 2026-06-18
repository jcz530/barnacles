CREATE TABLE `port_screenshots` (
	`id` text PRIMARY KEY NOT NULL,
	`port` integer NOT NULL,
	`process_name` text NOT NULL,
	`content_signature` text,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`captured_at` integer NOT NULL,
	`last_accessed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `port_screenshots_port_process_idx` ON `port_screenshots` (`port`,`process_name`);