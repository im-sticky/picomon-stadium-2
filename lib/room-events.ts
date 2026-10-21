import { draftTurn } from "@/lib/draft";
import { isTypeChoice } from "@/lib/type-battle";
import type { PublicPlayer, RoomState, Slot, TypeChoice } from "@/lib/types";

/**
 * What changed in a room, published on Ably after the write commits. Each carries
 * enough to update both players' screens without refetching.
 */
export type RoomEvent =
  | { kind: "type-battle-started"; round: 1 }
  | { kind: "type-round-resolved"; round: number; picks: { 1: TypeChoice; 2: TypeChoice }; winner: Slot | null }
  | { kind: "type-round-started"; round: number }
  | { kind: "draft-started"; firstDrafter: Slot }
  | { kind: "draft-picked"; pickIndex: number; slot: Slot; pokemonId: string };

/**
 * Events a client can apply. `player-joined` is the existing Ably message; your own
 * type pick comes only from your POST response, because it's secret until the reveal.
 */
export type SyncEvent =
  | RoomEvent
  | { kind: "player-joined"; players: PublicPlayer[] }
  | { kind: "own-type-pick"; round: number; type: TypeChoice };

export type ApplyResult =
  /** The event was next in line: this is the new state. */
  | { next: RoomState }
  /** Already applied (a duplicate, or the picker's echo) and it matches. */
  | { same: true }
  /** An earlier event is missing: hold this one until it arrives. */
  | { hold: true }
  /** Doesn't fit, or contradicts what's held: fetch from the server. */
  | { refetch: "conflict" | "no-state" };

const SAME = { same: true } as const;
const HOLD = { hold: true } as const;
const CONFLICT = { refetch: "conflict" } as const;

const isSlot = (v: unknown): v is Slot => v === 1 || v === 2;
const isRound = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;

/** The event in an Ably message's data, or null if it isn't one this client knows. */
export function parseRoomEvent(data: unknown): RoomEvent | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  switch (d.kind) {
    case "type-battle-started":
      return d.round === 1 ? { kind: d.kind, round: 1 } : null;
    case "type-round-resolved": {
      const picks = d.picks as Record<string, unknown> | undefined;
      if (!isRound(d.round) || !picks || !isTypeChoice(picks[1]) || !isTypeChoice(picks[2])) return null;
      if (d.winner !== null && !isSlot(d.winner)) return null;
      return { kind: d.kind, round: d.round, picks: { 1: picks[1], 2: picks[2] }, winner: d.winner };
    }
    case "type-round-started":
      return isRound(d.round) ? { kind: d.kind, round: d.round } : null;
    case "draft-started":
      return isSlot(d.firstDrafter) ? { kind: d.kind, firstDrafter: d.firstDrafter } : null;
    case "draft-picked":
      if (!Number.isInteger(d.pickIndex) || (d.pickIndex as number) < 0) return null;
      if (!isSlot(d.slot) || typeof d.pokemonId !== "string") return null;
      return { kind: d.kind, pickIndex: d.pickIndex as number, slot: d.slot, pokemonId: d.pokemonId };
    default:
      return null;
  }
}

/** A fresh type battle round as `getRoomState` returns it. */
function newRound(round: number) {
  return { round, yourPick: null, opponentPick: null, winner: null, firstDrafter: null };
}

/**
 * Applies `event` to `state` if it's next in line. Pure: the rules for duplicates,
 * gaps and conflicts all live here, and `lib/room-sync.ts` acts on the result.
 */
export function applyEvent(state: RoomState | null, event: SyncEvent): ApplyResult {
  if (!state) return { refetch: "no-state" };
  const me = state.you.slot;
  const { phase, typeBattle: tb, draft } = state;

  switch (event.kind) {
    case "player-joined":
      // The roster only changes in the lobby, and the message carries all of it.
      return { next: { ...state, players: event.players } };

    case "type-battle-started":
      if (phase !== "lobby") return SAME;
      return { next: { ...state, phase: "type-battle", typeBattle: newRound(1), draft: null } };

    case "own-type-pick":
      if (phase === "lobby") return HOLD;
      if (phase === "draft" || !tb || event.round < tb.round) return SAME;
      if (event.round > tb.round) return HOLD;
      if (tb.yourPick === null) return { next: { ...state, typeBattle: { ...tb, yourPick: event.type } } };
      return tb.yourPick === event.type ? SAME : CONFLICT;

    case "type-round-resolved": {
      if (phase === "lobby") return HOLD;
      if (phase === "draft" || !tb || event.round < tb.round) return SAME;
      if (event.round > tb.round) return HOLD;
      const yours = event.picks[me];
      const theirs = event.picks[me === 1 ? 2 : 1];
      if (tb.yourPick !== null && tb.yourPick !== yours) return CONFLICT;
      if (tb.opponentPick === null) {
        return { next: { ...state, typeBattle: { ...tb, yourPick: yours, opponentPick: theirs, winner: event.winner } } };
      }
      return tb.opponentPick === theirs && tb.winner === event.winner ? SAME : CONFLICT;
    }

    case "type-round-started":
      if (phase === "lobby") return HOLD;
      if (phase === "draft" || !tb || event.round <= tb.round) return SAME;
      if (event.round > tb.round + 1) return HOLD;
      return { next: { ...state, typeBattle: newRound(event.round) } };

    case "draft-started":
      if (phase === "lobby") return HOLD;
      if (phase === "draft") return draft?.firstDrafter === event.firstDrafter ? SAME : CONFLICT;
      return {
        next: { ...state, phase: "draft", typeBattle: null, draft: { firstDrafter: event.firstDrafter, picks: [] } },
      };

    case "draft-picked": {
      if (phase !== "draft" || !draft) return HOLD;
      const { picks } = draft;
      if (event.pickIndex < picks.length) {
        const held = picks[event.pickIndex];
        return held.slot === event.slot && held.pokemonId === event.pokemonId ? SAME : CONFLICT;
      }
      if (event.pickIndex > picks.length) return HOLD;
      if (draftTurn(draft.firstDrafter, event.pickIndex) !== event.slot) return CONFLICT;
      const pick = { slot: event.slot, pokemonId: event.pokemonId };
      return { next: { ...state, draft: { ...draft, picks: [...picks, pick] } } };
    }
  }
}

/**
 * How far along the room is, as a number that only grows: phase, then (in the
 * type battle) round and how much of it is done, then (in the draft) picks made.
 */
export function progress(state: RoomState): number {
  const { typeBattle: tb, draft } = state;
  if (state.phase === "draft" && draft) return 2e6 + draft.picks.length;
  if (state.phase === "type-battle" && tb) {
    const stage = tb.opponentPick !== null ? 2 : tb.yourPick !== null ? 1 : 0;
    return 1e6 + tb.round * 10 + stage;
  }
  return state.players.length;
}

/** The parts of the state two clients must agree on, as a comparable string. */
export function stateKey(state: RoomState): string {
  const { phase, battleSize, players, typeBattle: tb, draft } = state;
  return JSON.stringify({
    phase,
    battleSize,
    players: players.map((p) => [p.id, p.name, p.slot]),
    typeBattle: tb && [tb.round, tb.yourPick, tb.opponentPick, tb.winner, tb.firstDrafter],
    draft: draft && [draft.firstDrafter, draft.picks.map((p) => [p.slot, p.pokemonId])],
  });
}

/** Whether this player is waiting on the opponent to act. */
export function isWaitingOnOpponent(state: RoomState): boolean {
  const me = state.you.slot;
  const { typeBattle: tb, draft } = state;
  if (state.phase === "draft" && draft) {
    const turn = draftTurn(draft.firstDrafter, draft.picks.length);
    return turn !== null && turn !== me;
  }
  if (state.phase === "type-battle" && tb) {
    if (tb.yourPick !== null && tb.opponentPick === null) return true;
    // The winner is choosing the draft order.
    return tb.winner !== null && tb.winner !== me && tb.firstDrafter === null;
  }
  return false;
}
