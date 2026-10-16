import type { PublicPlayer, RoomState } from "@/lib/types";

export type RoomSyncDeps = {
  subscribe(onPlayers: (players: PublicPlayer[]) => void): () => void;
  onReconnect(cb: () => void): () => void;
  onVisible(cb: () => void): () => void;
  fetchState(): Promise<RoomState | null>;
  onState(state: RoomState): void;
  onPlayers(players: PublicPlayer[]): void;
  onGone(): void;
};

export function startRoomSync(deps: RoomSyncDeps): () => void {
  let stopped = false;
  let latest = 0;

  const refetch = async () => {
    const id = ++latest;
    let state: RoomState | null;
    try {
      state = await deps.fetchState();
    } catch {
      return; // network error: a later reconnect/visible refetch retries
    }
    if (stopped || id !== latest) return;
    if (state === null) deps.onGone();
    else deps.onState(state);
  };

  // Subscribe first so no event is missed between fetch and subscription.
  const unsubs = [
    deps.subscribe((players) => {
      if (!stopped) deps.onPlayers(players);
    }),
    deps.onReconnect(() => void refetch()),
    deps.onVisible(() => void refetch()),
  ];
  void refetch();

  return () => {
    stopped = true;
    unsubs.forEach((u) => u());
  };
}
