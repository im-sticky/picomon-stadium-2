CREATE TABLE `battles` (
	`room_code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`stage` text NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`step_starts` text NOT NULL,
	`deadline` integer,
	`p1_timeouts` integer DEFAULT 0 NOT NULL,
	`p2_timeouts` integer DEFAULT 0 NOT NULL,
	`p1_order` text DEFAULT '[]' NOT NULL,
	`p2_order` text DEFAULT '[]' NOT NULL,
	`winner` integer,
	`end_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE no action
);
