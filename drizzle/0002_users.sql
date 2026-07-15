CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL UNIQUE,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`plant` text DEFAULT 'TYANA OTOMOTİV' NOT NULL,
	`department` text DEFAULT 'Kalite' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CHECK (`role` IN ('admin', 'quality_manager', 'quality_engineer', 'process_engineer', 'approver', 'operator', 'viewer')),
	CHECK (`status` IN ('active', 'inactive', 'invited')),
	CHECK (length(`email`) BETWEEN 3 AND 254),
	CHECK (length(`display_name`) BETWEEN 2 AND 100),
	CHECK (length(`plant`) BETWEEN 1 AND 120),
	CHECK (length(`department`) BETWEEN 1 AND 120),
	CHECK (`version` >= 1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_status_idx` ON `users` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_role_idx` ON `users` (`role`);
