CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`project_code` text NOT NULL,
	`part_number` text NOT NULL,
	`part_name` text NOT NULL,
	`product_group` text NOT NULL,
	`revision` text DEFAULT 'A' NOT NULL,
	`phase` text DEFAULT 'Prototip' NOT NULL,
	`status` text DEFAULT 'Taslak' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `projects_updated_idx` ON `projects` (`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_entity_idx` ON `audit_events` (`entity_type`, `entity_id`, `created_at`);
