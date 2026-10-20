CREATE TABLE `draft_picks` (
	`room_code` text NOT NULL,
	`pick_index` integer NOT NULL,
	`slot` integer NOT NULL,
	`pokemon_id` text NOT NULL,
	`picked_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `pick_index`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_picks_room_code_pokemon_id_unique` ON `draft_picks` (`room_code`,`pokemon_id`);