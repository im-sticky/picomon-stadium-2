import { applyEvent, isWaitingOnOpponent, progress, stateKey, type SyncEvent } from "@/lib/room-events";
import type { RoomState } from "@/lib/types";

export type RoomSyncDeps = {
  /** Calls `onEvent` for every room message: its event, or null for one that only says "something changed". */
  subscribe(onEvent: (event: SyncEvent | null) => void): () => void;
  onReconnect(cb: () => void): () => void;
  onVisible(cb: () => void): () => void;
  /** Whether the tab is visible: the idle check only fetches while it is. */
  isVisible(): boolean;
  fetchState(): Promise<RoomState | null>;
  onState(state: RoomState): void;
  onGone(): void;
};

// Backoff before each retry of a rejected fetch (so up to 2 retries).
const RETRY_DELAYS_MS = [500, 1500];
/** How long an event that's ahead waits for the one it follows before a catch-up fetch. */
export const HOLD_MS = 500;
/** Background check after events settle. */
export const VERIFY_DEBOUNCE_MS = 1500;
/** Background check while waiting on the opponent with no events, in case a publish failed. */
export const IDLE_VERIFY_MS = 15_000;
// A server snapshot behind local state this many times in a row counts as a discrepancy.
const MAX_BEHIND = 3;
// This many corrections within the window and events aren't trusted for the session.
const MAX_CORRECTIONS = 3;
const CORRECTION_WINDOW_MS = 60_000;
const LOGGED_EVENTS = 10;

export type RoomSync = {
  stop(): void;
  /** Fetch the latest state now, e.g. after an action whose response had no event. */
  refetch(): void;
  /** Apply an event from this player's own action (its POST response). */
  apply(event: SyncEvent): void;
};

/**
 * Keeps one room's state: applies the events in Ably messages and POST responses as
 * they arrive, and checks that state against the server in the background. The
 * server always wins a disagreement.
 */
export function startRoomSync(deps: RoomSyncDeps): RoomSync {
  let stopped = false;
  let latest = 0; // the newest fetch; older ones are dropped
  let applied = 0; // bumped by every event that changes the state
  let current: RoomState | null = null;
  let held: SyncEvent[] = [];
  let behind = 0;
  let legacy = false; // after too many corrections: refetch on every event, as before
  const corrections: number[] = [];
  const recent: SyncEvent[] = [];
  const timers: Record<"hold" | "verify" | "idle", ReturnType<typeof setTimeout> | undefined> = {
    hold: undefined,
    verify: undefined,
    idle: undefined,
  };

  const clear = (name: keyof typeof timers) => {
    clearTimeout(timers[name]);
    timers[name] = undefined;
  };

  const scheduleVerify = () => {
    clear("verify");
    timers.verify = setTimeout(() => void refetch(), VERIFY_DEBOUNCE_MS);
  };

  // Restarted by every state change, so it only fires after 15s with no events.
  const armIdle = () => {
    clear("idle");
    if (!current || !isWaitingOnOpponent(current)) return;
    timers.idle = setTimeout(() => {
      if (deps.isVisible()) void refetch();
      armIdle();
    }, IDLE_VERIFY_MS);
  };

  const setState = (state: RoomState) => {
    current = state;
    deps.onState(state);
    armIdle();
  };

  /** Applies every held event that's now next in line, in order. */
  const drain = () => {
    let changed = false;
    for (let i = 0; i < held.length; ) {
      const result = applyEvent(current, held[i]);
      if ("hold" in result) {
        i++;
        continue;
      }
      const [event] = held.splice(i, 1);
      i = 0; // this one may unblock an event held earlier
      if ("next" in result) {
        applied++;
        current = result.next;
        changed = true;
      } else if ("refetch" in result) {
        if (result.refetch === "conflict") console.warn("room-sync: event conflicts with local state", event);
        void refetch();
      }
    }
    if (changed) {
      setState(current!);
      scheduleVerify();
    }
    if (held.length === 0) clear("hold");
    else
      timers.hold ??= setTimeout(() => {
        // The missing event never came: catch up from the server.
        timers.hold = undefined;
        held = [];
        void refetch();
      }, HOLD_MS);
  };

  const correct = (local: RoomState, server: RoomState) => {
    console.error("room-sync: discrepancy", { local, server, lastEvents: [...recent] });
    behind = 0;
    setState(server);
    const now = Date.now();
    corrections.push(now);
    while (corrections[0] <= now - CORRECTION_WINDOW_MS) corrections.shift();
    if (corrections.length >= MAX_CORRECTIONS && !legacy) {
      legacy = true;
      held = [];
      clear("hold");
      console.error("room-sync: too many corrections; refetching on every event from now on");
    }
  };

  /** Compares a server snapshot with local state and keeps whichever is right. */
  const reconcile = (server: RoomState, appliedAtStart: number) => {
    const local = current;
    if (legacy || local === null) {
      behind = 0;
      setState(server);
      drain();
      return;
    }
    // Events arrived while the fetch was in flight, so the snapshot may be older
    // than what's shown. Check again once they settle.
    if (applied !== appliedAtStart) return scheduleVerify();

    const diff = progress(server) - progress(local);
    if (diff < 0) {
      // Local state only comes from committed writes, so this is a stale read.
      if (++behind < MAX_BEHIND) return scheduleVerify();
      return correct(local, server);
    }
    behind = 0;
    if (diff > 0) {
      console.warn("room-sync: caught up from the server", { local, server });
      setState(server);
      drain();
    } else if (stateKey(server) !== stateKey(local)) {
      correct(local, server);
    }
  };

  const refetch = async () => {
    const id = ++latest;
    const appliedAtStart = applied;
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
    else reconcile(state, appliedAtStart);
  };

  const apply = (event: SyncEvent) => {
    if (stopped) return;
    recent.push(event);
    if (recent.length > LOGGED_EVENTS) recent.shift();
    if (legacy) return void refetch();
    held.push(event);
    drain();
  };

  // Subscribe first so no event is missed between fetch and subscription.
  const unsubs = [
    deps.subscribe((event) => {
      if (stopped) return;
      if (event) apply(event);
      else void refetch();
    }),
    deps.onReconnect(() => void refetch()),
    deps.onVisible(() => void refetch()),
  ];
  void refetch();

  return {
    stop() {
      stopped = true;
      unsubs.forEach((u) => u());
      (Object.keys(timers) as (keyof typeof timers)[]).forEach(clear);
    },
    refetch() {
      if (!stopped) void refetch();
    },
    apply,
  };
}
