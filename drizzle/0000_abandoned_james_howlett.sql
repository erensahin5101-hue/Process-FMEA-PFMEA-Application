CREATE TABLE `processes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`input_material` text DEFAULT '' NOT NULL,
	`output_material` text DEFAULT '' NOT NULL,
	`equipment` text DEFAULT '' NOT NULL,
	`tooling` text DEFAULT '' NOT NULL,
	`special_process` integer DEFAULT false NOT NULL,
	`outsourced` integer DEFAULT false NOT NULL,
	`control_method` text DEFAULT '' NOT NULL,
	`characteristics` text DEFAULT '[]' NOT NULL,
	`risk_template` text DEFAULT '[]' NOT NULL,
	`reaction_plan` text DEFAULT '' NOT NULL,
	`work_instruction` text DEFAULT '' NOT NULL,
	`cycle_time_sec` real DEFAULT 0 NOT NULL,
	`setup_time_min` real DEFAULT 0 NOT NULL,
	`owner` text DEFAULT 'Kalite Mühendisliği' NOT NULL,
	`revision` text DEFAULT 'A' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`approval_status` text DEFAULT 'draft' NOT NULL,
	`document_ref` text DEFAULT '' NOT NULL,
	`pfmea_function` text DEFAULT '' NOT NULL,
	`process_standard` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processes_code_unique` ON `processes` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `processes_name_unique` ON `processes` (`name`);