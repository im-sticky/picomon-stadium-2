CREATE TABLE `type_picks` (
	`room_code` text NOT NULL,
	`round` integer NOT NULL,
	`slot` integer NOT NULL,
	`type` text NOT NULL,
	`picked_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `round`, `slot`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `rooms` ADD `phase` text DEFAULT 'lobby' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `type_round` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `type_winner` integer;--> statement-breakpoint
ALTER TABLE `rooms` ADD `first_drafter` integer;