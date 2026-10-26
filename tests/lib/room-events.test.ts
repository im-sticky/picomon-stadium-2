import { describe, it, expect } from "vitest";
import { applyEvent, isWaitingOnOpponent, parseRoomEvent, progress, stateKey, type SyncEvent } from "@/lib/room-events";
import type { DraftPick, PublicPlayer, RoomState, TypeBattleView } from "@/lib/types";

const players: PublicPlayer[] = [
  { id: "a", name: "Ash", trainer: null, slot: 1 },
  { id: "b", name: "Bea", trainer: null, slot: 2 },
];
const lobby: RoomState = {
  code: "ABCD",
  you: { id: "a", slot: 1 },
  players,
  phase: "lobby",
  game: 1,
  battleSize: 6, draftType: "standard",
  typeBattle: null,
  draft: null,
  battle: null,
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

// A full draft (snake order from the host), then the battle on top of it.
const fullDraft: DraftPick[] = [1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1].map((slot, i) => ({
  slot: slot as 1 | 2,
  pokemonId: `mon${i}`,
}));
type Battle = NonNullable<RoomState["battle"]>;
const battling = (stage: Battle["stage"] = "team-order", result: Battle["result"] = null): RoomState => ({
  ...drafting(fullDraft),
  phase: "battle",
  battle: { stage, result },
});
const battleStarted: SyncEvent = { kind: "battle-started", battleSize: 6, deadline: 2_000, at: 1_000 };

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

  describe("battle", () => {
    it("every type battle event is stale", () => {
      const events: SyncEvent[] = [
        { kind: "type-battle-started", round: 1 },
        resolved(1),
        { kind: "type-round-started", round: 2 },
        { kind: "own-type-pick", round: 1, type: "fire" },
      ];
      for (const event of events) expect(applyEvent(battling(), event)).toEqual({ same: true });
    });

    it("draft events match the held draft, or conflict", () => {
      expect(applyEvent(battling(), { kind: "draft-started", firstDrafter: 1 })).toEqual({ same: true });
      expect(applyEvent(battling(), { kind: "draft-started", firstDrafter: 2 })).toEqual({ refetch: "conflict" });
      expect(applyEvent(battling(), picked(11, 1, "mon11"))).toEqual({ same: true });
      expect(applyEvent(battling(), picked(11, 1, "lugia"))).toEqual({ refetch: "conflict" });
      expect(applyEvent(battling(), picked(12, 2, "lugia"))).toEqual({ refetch: "conflict" });
    });

    it("battle-started moves a full draft into the battle, keeping the draft", () => {
      expect(applyEvent(drafting(fullDraft), battleStarted)).toEqual({ next: battling() });
      expect(applyEvent(battling(), battleStarted)).toEqual({ same: true });
      expect(applyEvent(battling("ended", { winner: 2, reason: "normal" }), battleStarted)).toEqual({ same: true });
    });

    it("battle-started waits for a late pick, or a draft not yet started", () => {
      expect(applyEvent(drafting(fullDraft.slice(0, 11)), battleStarted)).toEqual({ hold: true });
      expect(applyEvent(lobby, battleStarted)).toEqual({ hold: true });
      expect(applyEvent(round(2), battleStarted)).toEqual({ hold: true });
    });

    it("stateKey tells battle stages and results apart", () => {
      const keys = [
        battling(),
        battling("in-progress"),
        battling("ended", { winner: 1, reason: "normal" }),
        battling("ended", { winner: 2, reason: "normal" }),
        battling("ended", { winner: 2, reason: "forfeit" }),
        battling("ended", { winner: null, reason: "abandoned" }),
      ].map(stateKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});

describe("rematch-started", () => {
  const ended = battling("ended", { winner: 1, reason: "normal" });
  const rematch: SyncEvent = { kind: "rematch-started", game: 2 };

  it("sends an ended battle back to a fresh Battle order, keeping the draft", () => {
    expect(applyEvent(ended, rematch)).toEqual({
      next: { ...ended, game: 2, battle: { stage: "team-order", result: null } },
    });
  });

  it("puts the next game's Battle order ahead of the ended battle", () => {
    const next = applyEvent(ended, rematch);
    expect("next" in next && progress(next.next)).toBeGreaterThan(progress(ended));
  });

  it("is a duplicate once applied, and a conflict if a whole game was missed", () => {
    expect(applyEvent({ ...battling("team-order", null), game: 2 }, rematch)).toEqual({ same: true });
    expect(applyEvent(ended, { kind: "rematch-started", game: 3 })).toEqual({ refetch: "conflict" });
    expect(applyEvent(drafting(), rematch)).toEqual({ refetch: "conflict" });
  });

  it("tells the games apart in the state key", () => {
    expect(stateKey({ ...round(1), game: 2 })).not.toBe(stateKey(round(1)));
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
      battleStarted,
      { kind: "rematch-started", game: 2 },
    ];
    for (const e of events) expect(parseRoomEvent(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(parseRoomEvent({})).toBeNull();
    expect(parseRoomEvent(null)).toBeNull();
    expect(parseRoomEvent({ kind: "draft-picked", pickIndex: -1, slot: 1, pokemonId: "x" })).toBeNull();
    expect(parseRoomEvent({ kind: "type-round-resolved", round: 1, picks: { 1: "fire", 2: "rock" }, winner: 1 })).toBeNull();
    // Your own secret pick is never accepted from a shared message.
    expect(parseRoomEvent({ kind: "own-type-pick", round: 1, type: "fire" })).toBeNull();
    expect(parseRoomEvent({ kind: "battle-started", battleSize: 5, deadline: 2_000, at: 1_000 })).toBeNull();
    expect(parseRoomEvent({ kind: "rematch-started", game: 1 })).toBeNull();
    // Battle events stay a generic "something changed" until the battle client routes them.
    expect(parseRoomEvent({ kind: "battle-order-progress", slot: 1, count: 2 })).toBeNull();
    expect(parseRoomEvent({ kind: "battle-step", step: 1, lines: [], asked: { 1: "move", 2: "move" } })).toBeNull();
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
      drafting(fullDraft),
      battling(),
      battling("in-progress"),
      battling("ended", { winner: 1, reason: "normal" }),
      // A rematch: the next game counts on from the last one.
      { ...round(1), game: 2 },
      { ...battling(), game: 2 },
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
