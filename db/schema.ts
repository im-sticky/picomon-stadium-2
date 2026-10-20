import { sqliteTable, text, integer, unique, primaryKey } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  // Pokémon each player sends into battle (3, 4 or 6), chosen by the host.
  battleSize: integer('battle_size').notNull().default(6),
  // 'lobby' until the host starts the battle, then 'type-battle', then 'draft' once
  // the type battle winner has chosen the draft order.
  phase: text('phase').notNull().default('lobby'),
  // Current type battle round (0 in the lobby, 1 once started, +1 after each draw).
  typeRound: integer('type_round').notNull().default(0),
  // Slot that won the type battle; null until a round is decided (draws leave it null).
  typeWinner: integer('type_winner'),
  // Slot that drafts first, chosen by the type battle winner.
  firstDrafter: integer('first_drafter'),
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

// One row per player per round. The primary key rejects a second pick in the same round.
export const typePicks = sqliteTable(
  'type_picks',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code),
    round: integer('round').notNull(),
    slot: integer('slot').notNull(),
    type: text('type').notNull(),
    pickedAt: integer('picked_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.roomCode, t.round, t.slot] })],
);

// One row per draft pick, in order. The primary key rejects two picks for the same
// turn, and the unique key rejects a Pokémon that's already been rented.
export const draftPicks = sqliteTable(
  'draft_picks',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code),
    // 0-11, in snake order.
    pickIndex: integer('pick_index').notNull(),
    slot: integer('slot').notNull(),
    pokemonId: text('pokemon_id').notNull(),
    pickedAt: integer('picked_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.roomCode, t.pickIndex] }), unique().on(t.roomCode, t.pokemonId)],
);
