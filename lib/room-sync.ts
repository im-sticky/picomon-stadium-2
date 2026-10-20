import type { PublicPlayer, RoomState } from "@/lib/types";

export type RoomSyncDeps = {
  /** Calls `onEvent` for every room event; `players` is set for player-joined. */
  subscribe(onEvent: (players?: PublicPlayer[]) => void): () => void;
  onReconnect(cb: () => void): () => void;
  onVisible(cb: () => void): () => void;
  fetchState(): Promise<RoomState | null>;
  onState(state: RoomState): void;
  onPlayers(players: PublicPlayer[]): void;
  onGone(): void;
};

// Backoff before each retry of a rejected fetch (so up to 2 retries).
const RETRY_DELAYS_MS = [500, 1500];

export type RoomSync = {
  stop(): void;
  /** Fetch the latest state now, e.g. after this player's own action. */
  refetch(): void;
};

export function startRoomSync(deps: RoomSyncDeps): RoomSync {
  let stopped = false;
  let latest = 0;

  const refetch = async () => {
    const id = ++latest;
    let state: RoomState | null = null;
    for (let attempt = 0; ; attempt++) {
      try {
        state = await deps.fetchState();
        break;
      } catch (err) {
        console.warn("room-sync: fetchState failed", err);
        // Out of retries: a later reconnect/visible/event refetch tries again.
        if (attempt >= RETRY_DELAYS_MS.length) return;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        if (stopped || id !== latest) return;
      }
    }
    if (stopped || id !== latest) return;
    if (state === null) deps.onGone();
    else deps.onState(state);
  };

  // Subscribe first so no event is missed between fetch and subscription.
  const unsubs = [
    deps.subscribe((players) => {
      if (stopped) return;
      if (players) deps.onPlayers(players);
      // An event means something changed: refetch, which also invalidates any
      // in-flight fetch that started before the event.
      void refetch();
    }),
    deps.onReconnect(() => void refetch()),
    deps.onVisible(() => void refetch()),
  ];
  void refetch();

  return {
    stop() {
      stopped = true;
      unsubs.forEach((u) => u());
    },
    refetch() {
      if (!stopped) void refetch();
    },
  };
}
