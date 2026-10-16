import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull().unique(),
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code),
    name: text('name').notNull(),
    slot: integer('slot').notNull(),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => [unique().on(t.roomCode, t.slot)],
);
