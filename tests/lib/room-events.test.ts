import { describe, it, expect } from "vitest";
import { applyEvent, isWaitingOnOpponent, parseRoomEvent, progress, type SyncEvent } from "@/lib/room-events";
import type { DraftPick, PublicPlayer, RoomState, TypeBattleView } from "@/lib/types";

const players: PublicPlayer[] = [
  { id: "a", name: "Ash", slot: 1 },
  { id: "b", name: "Bea", slot: 2 },
];
const lobby: RoomState = {
  code: "ABCD",
  you: { id: "a", slot: 1 },
  players,
  phase: "lobby",
  battleSize: 6,
  typeBattle: null,
  draft: null,
};
const round = (r: number, more: Partial<TypeBattleView> = {}): RoomState => ({
  ...lobby,
  phase: "type-battle",
  typeBattle: { round: r, yourPick: null, opponentPick: null, winner: null, firstDrafter: null, ...more },
});
// The host (slot 1) drafts first: snake order is 1 2 2 1 1 2 ...
const drafting = (picks: DraftPick[] = []): RoomState => ({
  ...lobby,
  phase: "draft",
  draft: { firstDrafter: 1, picks },
});

const resolved = (r: number, winner: 1 | 2 | null = 1): SyncEvent => ({
  kind: "type-round-resolved",
  round: r,
  picks: { 1: "fire", 2: "grass" },
  winner,
});
const picked = (pickIndex: number, slot: 1 | 2, pokemonId: string): SyncEvent => ({
  kind: "draft-picked",
  pickIndex,
  slot,
  pokemonId,
});

describe("applyEvent", () => {
  it("asks for a fetch when there's no state yet", () => {
    expect(applyEvent(null, { kind: "type-battle-started", round: 1 })).toEqual({ refetch: "no-state" });
  });

  it("player-joined replaces the roster", () => {
    const alone = { ...lobby, players: [players[0]] };
    expect(applyEvent(alone, { kind: "player-joined", players })).toEqual({ next: lobby });
  });

  describe("type battle", () => {
    it("type-battle-started moves the lobby into round 1, once", () => {
      const event: SyncEvent = { kind: "type-battle-started", round: 1 };
      expect(applyEvent(lobby, event)).toEqual({ next: round(1) });
      expect(applyEvent(round(1), event)).toEqual({ same: true });
    });

    it("own-type-pick sets your pick; a different one for the same round conflicts", () => {
      const event: SyncEvent = { kind: "own-type-pick", round: 1, type: "fire" };
      expect(applyEvent(round(1), event)).toEqual({ next: round(1, { yourPick: "fire" }) });
      expect(applyEvent(round(1, { yourPick: "fire" }), event)).toEqual({ same: true });
      expect(applyEvent(round(1, { yourPick: "water" }), event)).toEqual({ refetch: "conflict" });
    });

    it("type-round-resolved reveals both picks from the viewer's side", () => {
      expect(applyEvent(round(1, { yourPick: "fire" }), resolved(1))).toEqual({
        next: round(1, { yourPick: "fire", opponentPick: "grass", winner: 1 }),
      });
      const guest = { ...round(1, { yourPick: "grass" }), you: { id: "b", slot: 2 as const } };
      expect(applyEvent(guest, resolved(1))).toEqual({
        next: { ...guest, typeBattle: { ...guest.typeBattle!, opponentPick: "fire", winner: 1 } },
      });
    });

    it("type-round-resolved: echo is ignored, a different result conflicts", () => {
      const done = round(1, { yourPick: "fire", opponentPick: "grass", winner: 1 });
      expect(applyEvent(done, resolved(1))).toEqual({ same: true });
      expect(applyEvent(done, resolved(1, 2))).toEqual({ refetch: "conflict" });
      expect(applyEvent(round(1, { yourPick: "water" }), resolved(1))).toEqual({ refetch: "conflict" });
    });

    it("type-round-resolved for an old round is ignored, for a later one is held", () => {
      expect(applyEvent(round(2), resolved(1))).toEqual({ same: true });
      expect(applyEvent(round(1), resolved(2))).toEqual({ hold: true });
      expect(applyEvent(lobby, resolved(1))).toEqual({ hold: true });
    });

    it("type-round-started starts the next round only", () => {
      const draw = round(1, { yourPick: "fire", opponentPick: "fire" });
      expect(applyEvent(draw, { kind: "type-round-started", round: 2 })).toEqual({ next: round(2) });
      expect(applyEvent(round(2), { kind: "type-round-started", round: 2 })).toEqual({ same: true });
      expect(applyEvent(round(1), { kind: "type-round-started", round: 3 })).toEqual({ hold: true });
    });

    it("never fills the opponent's pick before type-round-resolved", () => {
      let state = round(1);
      for (const event of [
        { kind: "own-type-pick", round: 1, type: "fire" },
        { kind: "type-round-started", round: 1 },
        { kind: "type-battle-started", round: 1 },
      ] as SyncEvent[]) {
        const result = applyEvent(state, event);
        if ("next" in result) state = result.next;
      }
      expect(state.typeBattle!.opponentPick).toBeNull();
    });
  });

  describe("draft", () => {
    it("draft-started opens an empty draft; a different first drafter conflicts", () => {
      const event: SyncEvent = { kind: "draft-started", firstDrafter: 1 };
      expect(applyEvent(round(1, { winner: 1 }), event)).toEqual({ next: drafting() });
      expect(applyEvent(drafting(), event)).toEqual({ same: true });
      expect(applyEvent(drafting(), { kind: "draft-started", firstDrafter: 2 })).toEqual({ refetch: "conflict" });
      expect(applyEvent(lobby, event)).toEqual({ hold: true });
    });

    it("draft-picked appends the next pick", () => {
      expect(applyEvent(drafting(), picked(0, 1, "lugia"))).toEqual({
        next: drafting([{ slot: 1, pokemonId: "lugia" }]),
      });
    });

    it("draft-picked: duplicate ignored, different pick at that index conflicts", () => {
      const one = drafting([{ slot: 1, pokemonId: "lugia" }]);
      expect(applyEvent(one, picked(0, 1, "lugia"))).toEqual({ same: true });
      expect(applyEvent(one, picked(0, 1, "gengar"))).toEqual({ refetch: "conflict" });
    });

    it("draft-picked ahead of the next index is held", () => {
      expect(applyEvent(drafting(), picked(1, 2, "gengar"))).toEqual({ hold: true });
      expect(applyEvent(round(1), picked(0, 1, "lugia"))).toEqual({ hold: true });
    });

    it("draft-picked by the player not on turn conflicts", () => {
      expect(applyEvent(drafting(), picked(0, 2, "lugia"))).toEqual({ refetch: "conflict" });
    });
  });
});

describe("parseRoomEvent", () => {
  it("accepts each event kind and rejects malformed data", () => {
    const events: SyncEvent[] = [
      { kind: "type-battle-started", round: 1 },
      resolved(3, null),
      { kind: "type-round-started", round: 2 },
      { kind: "draft-started", firstDrafter: 2 },
      picked(4, 1, "snorlax"),
    ];
    for (const e of events) expect(parseRoomEvent(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(parseRoomEvent({})).toBeNull();
    expect(parseRoomEvent(null)).toBeNull();
    expect(parseRoomEvent({ kind: "draft-picked", pickIndex: -1, slot: 1, pokemonId: "x" })).toBeNull();
    expect(parseRoomEvent({ kind: "type-round-resolved", round: 1, picks: { 1: "fire", 2: "rock" }, winner: 1 })).toBeNull();
    // Your own secret pick is never accepted from a shared message.
    expect(parseRoomEvent({ kind: "own-type-pick", round: 1, type: "fire" })).toBeNull();
  });
});

describe("progress and isWaitingOnOpponent", () => {
  it("progress only grows through a match", () => {
    const steps = [
      { ...lobby, players: [players[0]] },
      lobby,
      round(1),
      round(1, { yourPick: "fire" }),
      round(1, { yourPick: "fire", opponentPick: "fire" }),
      round(2),
      drafting(),
      drafting([{ slot: 1, pokemonId: "lugia" }]),
    ];
    const values = steps.map(progress);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(new Set(values).size).toBe(values.length);
  });

  it("waiting: picked a type, the other player's draft turn, or the winner choosing order", () => {
    expect(isWaitingOnOpponent(round(1))).toBe(false);
    expect(isWaitingOnOpponent(round(1, { yourPick: "fire" }))).toBe(true);
    expect(isWaitingOnOpponent(round(1, { yourPick: "fire", opponentPick: "water", winner: 2 }))).toBe(true);
    expect(isWaitingOnOpponent(round(1, { yourPick: "fire", opponentPick: "grass", winner: 1 }))).toBe(false);
    expect(isWaitingOnOpponent(drafting())).toBe(false);
    expect(isWaitingOnOpponent(drafting([{ slot: 1, pokemonId: "lugia" }]))).toBe(true);
  });
});
