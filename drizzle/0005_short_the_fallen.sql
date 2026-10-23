ALTER TABLE `players` ADD `trainer` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `draft_type` text DEFAULT 'standard' NOT NULL;