import { describe, it, expect, vi } from "vitest";
import { startRoomSync, type RoomSyncDeps } from "@/lib/room-sync";
import type { PublicPlayer, RoomState } from "@/lib/types";

const p1: PublicPlayer = { id: "a", name: "Ash", slot: 1 } as PublicPlayer;
const p2: PublicPlayer = { id: "b", name: "Bea", slot: 2 } as PublicPlayer;
const state1: RoomState = { code: "ABC234", you: { id: "a", slot: 1 }, players: [p1] } as RoomState;
const state2: RoomState = { ...state1, players: [p1, p2] };

function setup(fetches: Array<Promise<RoomState | null>>) {
  const order: string[] = [];
  const cbs: {
    players?: (p: PublicPlayer[]) => void;
    reconnect?: () => void;
    visible?: () => void;
  } = {};
  const unsubs = { sub: vi.fn(), rec: vi.fn(), vis: vi.fn() };
  let i = 0;
  const deps = {
    subscribe: (cb) => { order.push("subscribe"); cbs.players = cb; return unsubs.sub; },
    onReconnect: (cb) => { cbs.reconnect = cb; return unsubs.rec; },
    onVisible: (cb) => { cbs.visible = cb; return unsubs.vis; },
    fetchState: vi.fn(() => { order.push("fetch"); return fetches[i++]; }),
    onState: vi.fn(),
    onPlayers: vi.fn(),
    onGone: vi.fn(),
  } satisfies RoomSyncDeps;
  return { deps: deps as RoomSyncDeps & typeof deps, order, cbs, unsubs };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

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

  it("player-joined event goes to onPlayers", () => {
    const s = setup([new Promise(() => {})]);
    startRoomSync(s.deps);
    s.cbs.players!([p1, p2]);
    expect(s.deps.onPlayers).toHaveBeenCalledWith([p1, p2]);
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
    const stop = startRoomSync(s.deps);
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
});
