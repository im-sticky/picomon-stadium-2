CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`room_code` text NOT NULL,
	`name` text NOT NULL,
	`slot` integer NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_secret_unique` ON `players` (`secret`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_room_code_slot_unique` ON `players` (`room_code`,`slot`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
