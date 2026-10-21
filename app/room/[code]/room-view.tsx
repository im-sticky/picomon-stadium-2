"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Ably from "ably";
import type { BattleEvent } from "@/lib/battle-types";
import type { PoolPokemon } from "@/lib/draft-pool";
import { parseRoomEvent, type SyncEvent } from "@/lib/room-events";
import { startRoomSync, type RoomSync } from "@/lib/room-sync";
import { isTypeChoice } from "@/lib/type-battle";
import type { PublicPlayer, RoomState } from "@/lib/types";
import { BattleOrderScreen, parseOrderProgress } from "./battle-order-screen";
import { LIVE_FAILED, LOADING, RoomNotice } from "./room-notice";
import { DraftScreen } from "./draft-screen";
import { RoomScreen } from "./room-screen";
import { TypeBattleScreen } from "./type-battle-screen";

/** POSTs a room action (`/api/rooms/<code>/<action>`); resolves to whether it succeeded. */
export type RoomAction = (action: string, body?: object) => Promise<boolean>;

/**
 * Battle screens listen here for the battle events room sync doesn't route. Null
 * means "you may have missed some" (the channel reattached or the tab came back).
 */
export type BattleListener = (event: BattleEvent | null) => void;
export type SubscribeBattle = (listener: BattleListener) => () => void;

/** `pool` is every Pokémon in the draft, built on the server from the patched dex. */
export function RoomView({ code, pool }: { code: string; pool: readonly PoolPokemon[] }) {
  const router = useRouter();
  const [state, setState] = useState<RoomState | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  const sync = useRef<RoomSync | null>(null);
  const battleListeners = useRef(new Set<BattleListener>());

  useEffect(() => {
    const realtime = new Ably.Realtime({ authUrl: "/api/ably-token" });
    const channel = realtime.channels.get(`room:${code}`);

    let subscribed: Promise<unknown> = Promise.resolve();
    let closed = false;

    const onConnectionProblem = (change: Ably.ConnectionStateChange) => {
      console.error(`ably connection ${change.current}`, change.reason);
      setLiveFailed(true);
    };
    const onConnected = () => setLiveFailed(false);
    realtime.connection.on(["failed", "suspended"], onConnectionProblem);
    realtime.connection.on("connected", onConnected);

    const toBattle = (event: BattleEvent | null) => battleListeners.current.forEach((l) => l(event));

    const roomSync = startRoomSync({
      subscribe(onEvent) {
        // A message that isn't a known event (like room-updated) just means "refetch".
        const listener = (msg: Ably.Message) => {
          const players = msg.data?.players as PublicPlayer[] | undefined;
          const progress = parseOrderProgress(msg.data);
          if (progress) {
            // Only the Battle order screen needs it; the room state doesn't change.
            toBattle(progress);
          } else if (msg.name === "player-joined") {
            onEvent(Array.isArray(players) ? { kind: "player-joined", players } : null);
          } else {
            onEvent(parseRoomEvent(msg.data));
          }
        };
        subscribed = channel.subscribe(listener).catch((err) => {
          // Closing the client on unmount rejects a pending attach; that's expected, not a failure.
          if (closed) return;
          console.error("ably channel attach failed", err);
          setLiveFailed(true);
        });
        return () => channel.unsubscribe(listener);
      },
      // Ordering dependency: startRoomSync calls `subscribe` before `onReconnect`,
      // so `subscribed` is already set when the after-attach refetch below reads it.
      onReconnect(cb) {
        let first = true;
        // Events before the channel attaches are lost: refetch once it has.
        void subscribed.then(() => {
          if (closed) return;
          cb();
          toBattle(null);
        });
        const handler = () => {
          if (first) {
            first = false;
            return;
          }
          cb();
          toBattle(null);
        };
        realtime.connection.on("connected", handler);
        return () => realtime.connection.off("connected", handler);
      },
      onVisible(cb) {
        const handler = () => {
          if (document.visibilityState !== "visible") return;
          cb();
          toBattle(null);
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
      },
      isVisible: () => document.visibilityState === "visible",
      async fetchState() {
        const res = await fetch("/api/rooms/" + code);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`fetch state failed: ${res.status}`);
        return (await res.json()) as RoomState;
      },
      onState: setState,
      onGone: () => router.replace("/?error=not-found"),
    });

    sync.current = roomSync;

    return () => {
      closed = true;
      realtime.connection.off(onConnectionProblem);
      realtime.connection.off("connected", onConnected);
      roomSync.stop();
      sync.current = null;
      realtime.close();
    };
  }, [code, router]);

  const onAction: RoomAction = useCallback(
    async (action, body = {}) => {
      let event: SyncEvent | null = null;
      try {
        const res = await fetch(`/api/rooms/${code}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) event = ownEvent((await res.json().catch(() => null))?.event);
        return res.ok;
      } catch {
        return false;
      } finally {
        // Apply the result now rather than waiting for the Ably echo. Without one
        // (an error, or nothing changed) refetch instead.
        if (event) sync.current?.apply(event);
        else sync.current?.refetch();
      }
    },
    [code],
  );

  const subscribeBattle: SubscribeBattle = useCallback((listener) => {
    const listeners = battleListeners.current;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const notice = liveFailed ? LIVE_FAILED : undefined;
  // The battle screen itself isn't built yet, so the Battle order stays up for the whole battle phase.
  if (state?.phase === "battle" && state.draft) {
    return (
      <BattleOrderScreen
        state={state}
        draft={state.draft}
        pool={pool}
        notice={notice}
        subscribeBattle={subscribeBattle}
      />
    );
  }
  if (state?.draft) {
    return <DraftScreen state={state} draft={state.draft} pool={pool} notice={notice} onAction={onAction} />;
  }
  if (state?.typeBattle) {
    return (
      <TypeBattleScreen
        key={state.typeBattle.round}
        state={state}
        battle={state.typeBattle}
        notice={notice}
        onAction={onAction}
      />
    );
  }
  if (state) return <RoomScreen state={state} notice={notice} onAction={onAction} />;
  return notice ? <RoomNotice message={notice} role="alert" /> : <RoomNotice message={LOADING} />;
}

/** The event in this player's own POST response: a shared one, or their secret type pick. */
function ownEvent(data: unknown): SyncEvent | null {
  const d = data as { kind?: unknown; round?: unknown; type?: unknown } | null;
  if (d?.kind === "own-type-pick" && Number.isInteger(d.round) && isTypeChoice(d.type)) {
    return { kind: "own-type-pick", round: d.round as number, type: d.type };
  }
  return parseRoomEvent(data);
}
