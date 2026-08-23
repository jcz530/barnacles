CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer,
	`error_message` text,
	`client_name` text,
	`client_version` text,
	`metadata` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_occurred_at_idx` ON `events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_source_name_occurred_at_idx` ON `events` (`source`,`name`,`occurred_at`);
