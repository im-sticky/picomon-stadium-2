import type { BattleResult, BattleStage } from "@/lib/battle-types";

export type Slot = 1 | 2;

export type PublicPlayer = {
  id: string;
  /** The player's trainer's name in title case (e.g. "Lt Surge"). Screens show it in uppercase. */
  name: string;
  /** The trainer key (`lib/trainers.ts`), for the sprite. Null for players from before trainers. */
  trainer: string | null;
  slot: Slot;
};

export type Phase = "lobby" | "type-battle" | "draft" | "battle";

/** How many Pokémon each player sends into battle, chosen by the host. Everyone drafts 6. */
export const BATTLE_SIZES = [3, 4, 6] as const;
export type BattleSize = (typeof BATTLE_SIZES)[number];
export const DEFAULT_BATTLE_SIZE: BattleSize = 6;

/**
 * The host's draft rules. Standard: one Ultra Ball and one Master Ball Pokémon per team.
 * Unlimited: no ball limits. Poké Ball: only Poké Ball tier Pokémon. Every type keeps
 * pick-once and one-of-each-item (`lib/draft.ts`).
 */
export const DRAFT_TYPES = ["standard", "unlimited", "pokeball"] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];
export const DEFAULT_DRAFT_TYPE: DraftType = "standard";
export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  standard: "Standard Draft",
  unlimited: "Unlimited Draft",
  pokeball: "Poké Ball Draft",
};

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
  /** 1, then +1 for each rematch. */
  game: number;
  battleSize: BattleSize;
  draftType: DraftType;
  /** Set only in the type-battle phase. */
  typeBattle: TypeBattleView | null;
  /** Set in the draft and battle phases: the Battle order screen shows both drafted teams. */
  draft: DraftView | null;
  /** Set only in the battle phase: which battle screen to show. The rest comes from `GET …/battle`. */
  battle: { stage: BattleStage; result: BattleResult | null } | null;
};
