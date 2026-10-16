"use client";

import type { RoomState } from "@/lib/types";

export function RoomScreen({ state }: { state: RoomState }) {
  const { code, players } = state;
  const host = players.find((p) => p.slot === 1);
  const guest = players.find((p) => p.slot === 2);

  if (players.length < 2) {
    return (
      <div>
        <p>Your room code</p>
        <p>
          <strong>{code}</strong>
        </p>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(code).catch(() => {})}>
          Copy code
        </button>
        <p>Send this to a friend. Waiting for someone to join…</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Room {code}</h2>
      <ul>
        {host && <li>{host.name} (host)</li>}
        {guest && <li>{guest.name}</li>}
      </ul>
      <p>Both players connected.</p>
    </div>
  );
}
