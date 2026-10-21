import type { BattleSize, Slot } from "@/lib/types";

// The battle as the API and clients see it. No `@pkmn/sim` import, so client code can use it.

/** Every choice the battle asks for gets this long. */
export const TIMER_MS = 75_000;
/** Timeouts apply this long after the deadline, so a click just before it isn't a strike. */
export const GRACE_MS = 1000;
/** Timeouts in a row that forfeit the battle. */
export const MAX_TIMEOUTS = 3;

export type BattleStage = "team-order" | "in-progress" | "ended";
/** What the engine is asking a player for; null when they're waiting. */
export type Asked = "team" | "move" | "switch" | null;
export type EndReason = "normal" | "forfeit" | "abandoned";
/** `winner` null is a tie. */
export type BattleResult = { winner: Slot | null; reason: EndReason };
export type BattleChoice = { kind: "move"; move: 1 | 2 | 3 | 4 } | { kind: "switch"; slot: 2 | 3 | 4 | 5 | 6 };

export type TeamMember = {
  /** 1-based index in this request's team: `switch N` refers to it. */
  position: number;
  /** The `data/pokemon` id (toID of the drafted species). */
  pokemonId: string;
  /** "Gengar, L50, F" */
  details: string;
  /** Exact, from the request. */
  hp: number;
  maxhp: number;
  status: string | null;
  fainted: boolean;
  active: boolean;
  stats: { atk: number; def: number; spa: number; spd: number; spe: number };
  item: string;
  ability: string;
  moves: string[];
};

export type MoveOption = {
  /** 1-based: the choice body's `move`. */
  move: number;
  id: string;
  name: string;
  pp: number;
  maxpp: number;
  disabled: boolean;
  target: string;
};

export type PlayerRequest =
  /** All 6, in draft order. */
  | { kind: "team"; size: BattleSize; team: TeamMember[] }
  | { kind: "move"; moves: MoveOption[]; canSwitch: boolean; trapped: boolean; team: TeamMember[] }
  /** A faint replacement or a U-turn. */
  | { kind: "switch"; team: TeamMember[] }
  /** The opponent is choosing. */
  | { kind: "wait"; team: TeamMember[] };

/** One player's view of the battle. Everything in it is either public or theirs. */
export type BattleView = {
  code: string;
  you: { slot: Slot };
  battleSize: BattleSize;
  stage: BattleStage;
  step: number;
  asked: { 1: Asked; 2: Asked };
  /** You've answered this step (locked in, for the team order). */
  chosen: boolean;
  /** Null once ended. */
  request: PlayerRequest | null;
  /** Only at 'team-order': your order so far, and how far the opponent's is. */
  order: { yours: number[]; opponentCount: number } | null;
  /** Unix ms, server clock. */
  deadline: number | null;
  /** For the client's clock offset. */
  serverNow: number;
  /** Consecutive timeouts, as settled when this step began. */
  timeouts: { 1: number; 2: number };
  /** This player's protocol lines for steps `from`..`step`. */
  log: { from: number; steps: string[][] };
  result: BattleResult | null;
};

/** Battle events on the room channel, published after the write commits. */
export type BattleEvent =
  | { kind: "battle-order-progress"; slot: Slot; count: number }
  | {
      kind: "battle-step";
      /** The step's position: it applies after step - 1. */
      step: number;
      /** This step's public lines; null when too big to publish, so fetch them. */
      lines: string[] | null;
      asked: { 1: Asked; 2: Asked };
      deadline: number | null;
      /** Server time at commit, for the clock offset. */
      at: number;
      timeouts: { 1: number; 2: number };
      /** Whose default (or forfeit) produced this step. */
      timedOut: Slot[];
      /** Set on the step that ends the battle. */
      result: BattleResult | null;
    };
