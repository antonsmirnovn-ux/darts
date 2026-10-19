import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const players=sqliteTable('club_players',{id:text('id').primaryKey(),name:text('name').notNull()});
export const matches=sqliteTable('club_matches',{id:text('id').primaryKey(),startedAt:text('started_at').notNull(),body:text('body').notNull(),tokenHash:text('token_hash').notNull(),revision:integer('revision').notNull()});

// Ownership/revision receipt: no game data is retained after an undo.
export const matchClaims=sqliteTable('club_match_claims',{id:text('id').primaryKey(),tokenHash:text('token_hash').notNull(),revision:integer('revision').notNull(),removed:integer('removed').notNull()});
