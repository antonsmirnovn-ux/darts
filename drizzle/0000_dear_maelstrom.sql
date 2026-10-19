CREATE TABLE `club_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`body` text NOT NULL,
	`token_hash` text NOT NULL,
	`revision` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `club_players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
