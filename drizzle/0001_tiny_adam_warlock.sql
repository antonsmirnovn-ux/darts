CREATE TABLE `club_match_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`revision` integer NOT NULL,
	`removed` integer NOT NULL
);
