"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Ably from "ably";
import { startRoomSync, type RoomSync } from "@/lib/room-sync";
import type { PublicPlayer, RoomState } from "@/lib/types";
import { LIVE_FAILED, LOADING, RoomNotice } from "./room-notice";
import { RoomScreen } from "./room-screen";
import { TypeBattleScreen } from "./type-battle-screen";

/** POSTs a room action (`/api/rooms/<code>/<action>`); resolves to whether it succeeded. */
export type RoomAction = (action: string, body?: object) => Promise<boolean>;

export function RoomView({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<RoomState | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  const sync = useRef<RoomSync | null>(null);

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

    const roomSync = startRoomSync({
      subscribe(onEvent) {
        // Every event means "something changed"; only player-joined carries data.
        const listener = (msg: Ably.Message) => {
          const players = msg.data?.players as PublicPlayer[] | undefined;
          onEvent(msg.name === "player-joined" && Array.isArray(players) ? players : undefined);
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
          if (!closed) cb();
        });
        const handler = () => {
          if (first) {
            first = false;
            return;
          }
          cb();
        };
        realtime.connection.on("connected", handler);
        return () => realtime.connection.off("connected", handler);
      },
      onVisible(cb) {
        const handler = () => {
          if (document.visibilityState === "visible") cb();
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
      },
      async fetchState() {
        const res = await fetch("/api/rooms/" + code);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`fetch state failed: ${res.status}`);
        return (await res.json()) as RoomState;
      },
      onState: setState,
      onPlayers: (players) => setState((prev) => (prev ? { ...prev, players } : prev)),
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
      try {
        const res = await fetch(`/api/rooms/${code}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        // Our own actions aren't always broadcast (a first pick isn't), so refetch.
        sync.current?.refetch();
      }
    },
    [code],
  );

  const notice = liveFailed ? LIVE_FAILED : undefined;
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
