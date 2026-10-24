ALTER TABLE `battles` ADD `rematch_by` integer;--> statement-breakpoint
ALTER TABLE `rooms` ADD `game` integer DEFAULT 1 NOT NULL;