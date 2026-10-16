"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Ably from "ably";
import { startRoomSync } from "@/lib/room-sync";
import type { PublicPlayer, RoomState } from "@/lib/types";
import { RoomScreen } from "./room-screen";

export function RoomView({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<RoomState | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);

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

    const stop = startRoomSync({
      subscribe(onPlayers) {
        const listener = (msg: Ably.Message) => {
          const players = msg.data?.players as PublicPlayer[] | undefined;
          if (Array.isArray(players)) onPlayers(players);
        };
        subscribed = channel.subscribe("player-joined", listener).catch((err) => {
          // Closing the client on unmount rejects a pending attach; that's expected, not a failure.
          if (closed) return;
          console.error("ably channel attach failed", err);
          setLiveFailed(true);
        });
        return () => channel.unsubscribe("player-joined", listener);
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

    return () => {
      closed = true;
      realtime.connection.off(onConnectionProblem);
      realtime.connection.off("connected", onConnected);
      stop();
      realtime.close();
    };
  }, [code, router]);

  const notice = liveFailed && <p role="alert">Live updates unavailable — refresh the page.</p>;
  return (
    <>
      {notice}
      {state ? <RoomScreen state={state} /> : <p>Loading…</p>}
    </>
  );
}
