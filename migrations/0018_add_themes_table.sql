CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`is_default` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`primary_color` text DEFAULT '#00c2e5' NOT NULL,
	`slate_color` text DEFAULT '#64748b' NOT NULL,
	`border_radius` text DEFAULT 'md' NOT NULL,
	`shadow_intensity` integer DEFAULT 3 NOT NULL,
	`custom_css_vars` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
