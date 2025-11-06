CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`is_default` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`primary_color` text DEFAULT '#00c2e5' NOT NULL,
	`secondary_color` text DEFAULT '#ec4899' NOT NULL,
	`tertiary_color` text DEFAULT '#8b5cf6' NOT NULL,
	`slate_color` text DEFAULT '#64748b' NOT NULL,
	`success_color` text DEFAULT '#10b981' NOT NULL,
	`danger_color` text DEFAULT '#ef4444' NOT NULL,
	`font_ui` text,
	`font_heading` text,
	`font_code` text,
	`border_radius` text DEFAULT 'md' NOT NULL,
	`custom_css_vars` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
