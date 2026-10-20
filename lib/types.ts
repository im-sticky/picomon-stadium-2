export type Slot = 1 | 2;

export type PublicPlayer = {
  id: string;
  name: string;
  slot: Slot;
};

export type Phase = "lobby" | "type-battle";

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

export type RoomState = {
  code: string;
  you: { id: string; slot: Slot };
  players: PublicPlayer[];
  phase: Phase;
  /** Null in the lobby. */
  typeBattle: TypeBattleView | null;
};
