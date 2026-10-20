export type Slot = 1 | 2;

export type PublicPlayer = {
  id: string;
  name: string;
  slot: Slot;
};

export type Phase = "lobby" | "type-battle" | "draft";

/** How many Pokémon each player sends into battle, chosen by the host. Everyone drafts 6. */
export const BATTLE_SIZES = [3, 4, 6] as const;
export type BattleSize = (typeof BATTLE_SIZES)[number];
export const DEFAULT_BATTLE_SIZE: BattleSize = 6;

export const TYPE_CHOICES = ["grass", "water", "fire"] as const;
export type TypeChoice = (typeof TYPE_CHOICES)[number];

/** The type battle as one player sees it. */
export type TypeBattleView = {
  round: number;
  yourPick: TypeChoice | null;
  /** Hidden (null) until both players have picked this round. */
  opponentPick: TypeChoice | null;
  /** Set once a round is decided; null while waiting or after a draw. */
  winner: Slot | null;
  firstDrafter: Slot | null;
};

/** One draft pick: who rented which Pokémon (a `data/pokemon` id). */
export type DraftPick = { slot: Slot; pokemonId: string };

/** The draft, the same for both players. Turn and picks left follow from `lib/draft.ts`. */
export type DraftView = {
  firstDrafter: Slot;
  /** In pick order. */
  picks: DraftPick[];
};

export type RoomState = {
  code: string;
  you: { id: string; slot: Slot };
  players: PublicPlayer[];
  phase: Phase;
  battleSize: BattleSize;
  /** Set only in the type-battle phase. */
  typeBattle: TypeBattleView | null;
  /** Set only in the draft phase. */
  draft: DraftView | null;
};
