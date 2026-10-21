import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SyncEvent } from "@/lib/room-events";
import { HOLD_MS, IDLE_VERIFY_MS, VERIFY_DEBOUNCE_MS, startRoomSync, type RoomSyncDeps } from "@/lib/room-sync";
import type { DraftPick, PublicPlayer, RoomState } from "@/lib/types";

const p1: PublicPlayer = { id: "a", name: "Ash", slot: 1 } as PublicPlayer;
const p2: PublicPlayer = { id: "b", name: "Bea", slot: 2 } as PublicPlayer;
const state1: RoomState = { code: "ABC234", you: { id: "a", slot: 1 }, players: [p1], phase: "lobby" } as RoomState;
const state2: RoomState = { ...state1, players: [p1, p2] };
// The host drafts first, so pick 0 is theirs and picks 1-2 are the guest's.
const draft = (...ids: string[]): RoomState => ({
  ...state2,
  phase: "draft",
  battleSize: 6,
  typeBattle: null,
  draft: {
    firstDrafter: 1,
    picks: ids.map((pokemonId, i): DraftPick => ({ slot: i === 0 || i === 3 ? 1 : 2, pokemonId })),
  },
});
const pick = (pickIndex: number, pokemonId: string): SyncEvent => ({
  kind: "draft-picked",
  pickIndex,
  slot: pickIndex === 0 || pickIndex === 3 ? 1 : 2,
  pokemonId,
});

type Fetch = Promise<RoomState | null> | (() => Promise<RoomState | null>);
function setup(fetches: Fetch[]) {
  const order: string[] = [];
  const cbs: {
    event?: (e: SyncEvent | null) => void;
    reconnect?: () => void;
    visible?: () => void;
  } = {};
  const unsubs = { sub: vi.fn(), rec: vi.fn(), vis: vi.fn() };
  let i = 0;
  const deps = {
    subscribe: (cb) => { order.push("subscribe"); cbs.event = cb; return unsubs.sub; },
    onReconnect: (cb) => { cbs.reconnect = cb; return unsubs.rec; },
    onVisible: (cb) => { cbs.visible = cb; return unsubs.vis; },
    isVisible: vi.fn(() => true),
    fetchState: vi.fn(() => { order.push("fetch"); const f = fetches[i++]; return typeof f === "function" ? f() : f; }),
    onState: vi.fn(),
    onGone: vi.fn(),
  } satisfies RoomSyncDeps;
  return { deps: deps as RoomSyncDeps & typeof deps, order, cbs, unsubs };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("startRoomSync", () => {
  it("subscribes before the first fetch", () => {
    const s = setup([Promise.resolve(state1)]);
    startRoomSync(s.deps);
    expect(s.order).toEqual(["subscribe", "fetch"]);
  });

  it("initial fetch result goes to onState", async () => {
    const s = setup([Promise.resolve(state1)]);
    startRoomSync(s.deps);
    await flush();
    expect(s.deps.onState).toHaveBeenCalledWith(state1);
  });

  it("a player-joined event updates the state without fetching", async () => {
    const s = setup([Promise.resolve(state1)]);
    startRoomSync(s.deps);
    await flush();
    s.cbs.event!({ kind: "player-joined", players: [p1, p2] });
    expect(s.deps.onState).toHaveBeenLastCalledWith(state2);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(1);
  });

  it("a message with no event refetches", async () => {
    const s = setup([Promise.resolve(state1), Promise.resolve(state2)]);
    startRoomSync(s.deps);
    await flush();
    s.cbs.event!(null);
    await flush();
    expect(s.deps.onState).toHaveBeenLastCalledWith(state2);
  });

  it("refetch() fetches now and supersedes an in-flight fetch", async () => {
    let resolveFirst!: (v: RoomState | null) => void;
    const s = setup([new Promise((r) => { resolveFirst = r; }), Promise.resolve(state2)]);
    const sync = startRoomSync(s.deps);
    sync.refetch();
    await flush();
    resolveFirst(state1);
    await flush();
    expect(s.deps.onState).toHaveBeenCalledTimes(1);
    expect(s.deps.onState).toHaveBeenCalledWith(state2);
  });

  it("refetches when the tab becomes visible", async () => {
    const s = setup([Promise.resolve(state1), Promise.resolve(state2)]);
    startRoomSync(s.deps);
    await flush();
    s.cbs.visible!();
    await flush();
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    expect(s.deps.onState).toHaveBeenLastCalledWith(state2);
  });

  it("refetches on Ably reconnect", async () => {
    const s = setup([Promise.resolve(state1), Promise.resolve(state2)]);
    startRoomSync(s.deps);
    await flush();
    s.cbs.reconnect!();
    await flush();
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    expect(s.deps.onState).toHaveBeenLastCalledWith(state2);
  });

  it("fetch returning null calls onGone", async () => {
    const s = setup([Promise.resolve(null)]);
    startRoomSync(s.deps);
    await flush();
    expect(s.deps.onGone).toHaveBeenCalledTimes(1);
    expect(s.deps.onState).not.toHaveBeenCalled();
  });

  it("stop() unsubscribes everything and ignores a pending fetch", async () => {
    let resolve!: (v: RoomState | null) => void;
    const s = setup([new Promise((r) => { resolve = r; })]);
    const { stop } = startRoomSync(s.deps);
    stop();
    expect(s.unsubs.sub).toHaveBeenCalled();
    expect(s.unsubs.rec).toHaveBeenCalled();
    expect(s.unsubs.vis).toHaveBeenCalled();
    resolve(state1);
    await flush();
    expect(s.deps.onState).not.toHaveBeenCalled();
    expect(s.deps.onGone).not.toHaveBeenCalled();
  });

  it("a stale earlier fetch does not overwrite a newer one", async () => {
    let resolveFirst!: (v: RoomState | null) => void;
    const s = setup([new Promise((r) => { resolveFirst = r; }), Promise.resolve(state2)]);
    startRoomSync(s.deps);
    s.cbs.visible!();
    await flush();
    resolveFirst(state1);
    await flush();
    expect(s.deps.onState).toHaveBeenCalledTimes(1);
    expect(s.deps.onState).toHaveBeenCalledWith(state2);
  });

  it("ignores a rejected fetch and retries on next trigger", async () => {
    const s = setup([Promise.reject(new Error("net")), Promise.resolve(state2)]);
    startRoomSync(s.deps);
    await flush();
    expect(s.deps.onState).not.toHaveBeenCalled();
    expect(s.deps.onGone).not.toHaveBeenCalled();
    s.cbs.visible!();
    await flush();
    expect(s.deps.onState).toHaveBeenCalledWith(state2);
  });

  it("a stale fetch does not overwrite a newer player-joined event", async () => {
    let resolve1!: (v: RoomState | null) => void;
    let resolve2!: (v: RoomState | null) => void;
    const s = setup([
      new Promise((r) => { resolve1 = r; }),
      new Promise((r) => { resolve2 = r; }),
    ]);
    startRoomSync(s.deps);
    // No state yet, so the event refetches, which supersedes the first fetch.
    s.cbs.event!({ kind: "player-joined", players: [p1, p2] });
    resolve1(state1);
    await flush();
    resolve2(state2);
    await flush();
    expect(s.deps.onState).not.toHaveBeenCalledWith(state1);
    expect(s.deps.onState).toHaveBeenLastCalledWith(state2);
  });

  it("retries a rejected fetch with backoff and then applies the state", async () => {
    vi.useFakeTimers();
    const s = setup([
      () => Promise.reject(new Error("net")),
      () => Promise.reject(new Error("net")),
      Promise.resolve(state2),
    ]);
    startRoomSync(s.deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    expect(s.deps.onState).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(3);
    expect(s.deps.onState).toHaveBeenCalledWith(state2);
  });

  it("gives up after 2 retries", async () => {
    vi.useFakeTimers();
    const s = setup([
      () => Promise.reject(new Error("a")),
      () => Promise.reject(new Error("b")),
      () => Promise.reject(new Error("c")),
      Promise.resolve(state2),
    ]);
    startRoomSync(s.deps);
    await vi.advanceTimersByTimeAsync(10000);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(3);
    expect(s.deps.onState).not.toHaveBeenCalled();
  });

  it("does not retry after stop()", async () => {
    vi.useFakeTimers();
    const s = setup([() => Promise.reject(new Error("a")), Promise.resolve(state2)]);
    const { stop } = startRoomSync(s.deps);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(1);
  });

  it("a newer refetch supersedes a pending retry", async () => {
    vi.useFakeTimers();
    const s = setup([() => Promise.reject(new Error("a")), Promise.resolve(state2), Promise.resolve(state1)]);
    startRoomSync(s.deps);
    await vi.advanceTimersByTimeAsync(0);
    s.cbs.visible!();
    await vi.advanceTimersByTimeAsync(10000);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    expect(s.deps.onState).toHaveBeenCalledTimes(1);
    expect(s.deps.onState).toHaveBeenCalledWith(state2);
  });
});

describe("startRoomSync events and background checks", () => {
  /** Starts with `initial` loaded (fake timers on), then queues `fetches`. */
  async function loaded(initial: RoomState, ...fetches: Fetch[]) {
    vi.useFakeTimers();
    const s = setup([Promise.resolve(initial), ...fetches]);
    const sync = startRoomSync(s.deps);
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(s.deps.onState).mockClear();
    return { ...s, sync };
  }

  it("applies an event at once and checks the server once the burst settles", async () => {
    const s = await loaded(draft(), Promise.resolve(draft("lugia", "gengar")));
    s.cbs.event!(pick(0, "lugia"));
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("lugia"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS - 100);
    s.cbs.event!(pick(1, "gengar"));
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("lugia", "gengar"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS - 100);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    // The server agreed, so nothing changed.
    expect(s.deps.onState).toHaveBeenCalledTimes(2);
  });

  it("apply() takes this player's own result, and the Ably echo is ignored", async () => {
    const s = await loaded(draft());
    s.sync.apply(pick(0, "lugia"));
    s.cbs.event!(pick(0, "lugia"));
    expect(s.deps.onState).toHaveBeenCalledTimes(1);
    expect(s.deps.onState).toHaveBeenCalledWith(draft("lugia"));
  });

  it("puts a swapped double pick back in order without fetching", async () => {
    const s = await loaded(draft("lugia"));
    s.cbs.event!(pick(2, "snorlax"));
    expect(s.deps.onState).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(HOLD_MS - 100);
    s.cbs.event!(pick(1, "gengar"));
    expect(s.deps.onState).toHaveBeenCalledTimes(1);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("lugia", "gengar", "snorlax"));
    await vi.advanceTimersByTimeAsync(HOLD_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(1);
  });

  it("catches up from the server when a missing event never arrives", async () => {
    const s = await loaded(draft("lugia"), Promise.resolve(draft("lugia", "gengar", "snorlax")));
    s.cbs.event!(pick(2, "snorlax"));
    await vi.advanceTimersByTimeAsync(HOLD_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("lugia", "gengar", "snorlax"));
    expect(console.error).not.toHaveBeenCalled();
  });

  it("drops a snapshot taken before an event arrived", async () => {
    let resolve!: (v: RoomState | null) => void;
    const s = await loaded(draft(), new Promise((r) => { resolve = r; }), Promise.resolve(draft("lugia")));
    s.cbs.visible!();
    s.cbs.event!(pick(0, "lugia"));
    resolve(draft());
    await vi.advanceTimersByTimeAsync(0);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("lugia"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(3);
    expect(s.deps.onState).toHaveBeenCalledTimes(1);
  });

  it("keeps local state while the server is briefly behind, then corrects on the third time", async () => {
    const behind = () => Promise.resolve(draft());
    const s = await loaded(draft(), behind, behind, behind);
    s.cbs.event!(pick(0, "lugia"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS * 2);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("lugia"));
    expect(console.error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(4);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft());
    expect(console.error).toHaveBeenCalledWith("room-sync: discrepancy", expect.anything());
  });

  it("replaces a state the server disagrees with", async () => {
    const s = await loaded(draft(), Promise.resolve(draft("gengar")));
    s.cbs.event!(pick(0, "lugia"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("gengar"));
    expect(console.error).toHaveBeenCalledWith("room-sync: discrepancy", expect.anything());
  });

  it("after 3 corrections in a minute, refetches on every event instead", async () => {
    const s = await loaded(
      draft(),
      Promise.resolve(draft("gengar")),
      Promise.resolve(draft("gengar", "lugia")),
      Promise.resolve(draft("gengar", "lugia", "mew")),
      Promise.resolve(draft("gengar", "lugia", "mew", "ho")),
    );
    s.cbs.event!(pick(0, "lugia"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS);
    s.cbs.event!(pick(1, "snorlax"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS);
    s.cbs.event!(pick(2, "dragonite"));
    await vi.advanceTimersByTimeAsync(VERIFY_DEBOUNCE_MS);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("too many corrections"));

    const calls = vi.mocked(s.deps.onState).mock.calls.length;
    s.cbs.event!(pick(3, "umbreon"));
    // The event's payload is ignored; the fetched state is used.
    expect(s.deps.onState).toHaveBeenCalledTimes(calls);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.deps.onState).toHaveBeenLastCalledWith(draft("gengar", "lugia", "mew", "ho"));
  });

  it("checks every 15s while waiting on the opponent, only while visible", async () => {
    const waiting = draft("lugia"); // the guest's turn, seen by the host
    const s = await loaded(waiting, Promise.resolve(waiting), Promise.resolve(waiting));
    await vi.advanceTimersByTimeAsync(IDLE_VERIFY_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    vi.mocked(s.deps.isVisible).mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(IDLE_VERIFY_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    vi.mocked(s.deps.isVisible).mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(IDLE_VERIFY_MS);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(3);
  });

  it("doesn't run the idle check on your own turn", async () => {
    const s = await loaded(draft());
    await vi.advanceTimersByTimeAsync(IDLE_VERIFY_MS * 3);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(1);
  });

  it("a conflicting duplicate refetches", async () => {
    const s = await loaded(draft("lugia"), Promise.resolve(draft("lugia")));
    s.cbs.event!(pick(0, "gengar"));
    await vi.advanceTimersByTimeAsync(0);
    expect(s.deps.fetchState).toHaveBeenCalledTimes(2);
    // The server agreed with local state, so nothing was corrected.
    expect(s.deps.onState).not.toHaveBeenCalled();
  });
});
