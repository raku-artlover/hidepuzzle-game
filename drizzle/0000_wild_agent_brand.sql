CREATE TABLE `rankings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_size` integer NOT NULL,
	`time_ms` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rankings_size_time_idx` ON `rankings` (`board_size`,`time_ms`,`created_at`);--> statement-breakpoint
CREATE INDEX `rankings_created_idx` ON `rankings` (`created_at`);