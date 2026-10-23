import { sqliteTable, text, integer, unique, primaryKey } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  // Pokémon each player sends into battle (3, 4 or 6), chosen by the host.
  battleSize: integer('battle_size').notNull().default(6),
  // The draft's rules, chosen by the host: 'standard' | 'unlimited' | 'pokeball'.
  draftType: text('draft_type').notNull().default('standard'),
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
    // The trainer's name (e.g. 'Lt Surge'): the player's name everywhere.
    name: text('name').notNull(),
    // The trainer key (e.g. 'lt_surge'), for the sprite. Null for rows from before trainers.
    trainer: text('trainer'),
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

// One battle per room: the engine's latest snapshot plus what the routes need without
// deserialising it. `state` and the orders are secret and never leave the server.
export const battles = sqliteTable('battles', {
  roomCode: text('room_code')
    .primaryKey()
    .references(() => rooms.code),
  // JSON.stringify(battle.toJSON()). Holds both teams, every choice and the PRNG state.
  state: text('state').notNull(),
  // Bumped by every save: the compare-and-swap guard. Not sent to clients.
  version: integer('version').notNull().default(1),
  // 'team-order' | 'in-progress' | 'ended'
  stage: text('stage').notNull(),
  // The current step. 0 is the intro and team preview.
  step: integer('step').notNull().default(0),
  // JSON number[]: the battle.log index where each step's lines begin; [0] is 0.
  stepStarts: text('step_starts').notNull(),
  // Unix ms when the current step's choices time out; null once ended.
  deadline: integer('deadline'),
  p1Timeouts: integer('p1_timeouts').notNull().default(0),
  p2Timeouts: integer('p2_timeouts').notNull().default(0),
  // JSON number[]: the Battle order so far, as 1-based positions in the player's draft
  // order. Secret: the opponent only sees its length.
  p1Order: text('p1_order').notNull().default('[]'),
  p2Order: text('p2_order').notNull().default('[]'),
  // Set when the stage is 'ended'. winner null with an end reason is a tie.
  winner: integer('winner'),
  endReason: text('end_reason'), // 'normal' | 'forfeit' | 'abandoned'
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
