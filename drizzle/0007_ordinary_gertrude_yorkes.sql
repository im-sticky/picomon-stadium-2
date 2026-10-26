ALTER TABLE `rooms` ADD `p1_ready` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `p2_ready` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `start_at` integer;--> statement-breakpoint
ALTER TABLE `rooms` ADD `options_changed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `lobby_version` integer DEFAULT 0 NOT NULL;