"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/codes";
import { normalizeName } from "@/lib/names";

export function HomeForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [busy, setBusy] = useState(false);

  // Show a changed initialError: adjust state during render (not in an effect).
  const [seenInitialError, setSeenInitialError] = useState(initialError);
  if (seenInitialError !== initialError) {
    setSeenInitialError(initialError);
    setError(initialError);
  }

  // Next keeps earlier routes alive in <Activity>; hiding runs effect cleanups, so
  // clear a stale busy flag then (it would otherwise stay disabled when re-shown).
  useEffect(() => () => setBusy(false), []);

  async function submit(url: string, body: { name: string }) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.code === "string") {
        router.push("/room/" + data.code);
        return;
      }
      setError(
        res.status === 404 || res.status === 409
          ? data?.error ?? "Something went wrong."
          : "Something went wrong. Try again.",
      );
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  function host() {
    const n = normalizeName(name);
    if (!n) return setError("Enter a name (1–12 characters).");
    void submit("/api/rooms", { name: n });
  }

  function join() {
    const n = normalizeName(name);
    if (!n) return setError("Enter a name (1–12 characters).");
    const trimmed = code.trim();
    if (trimmed.length !== 4) return setError("Enter a 4-character room code.");
    const c = normalizeCode(trimmed);
    if (!c) return setError("Room not found.");
    void submit(`/api/rooms/${c}/join`, { name: n });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) join();
      }}
    >
      <div>
        <label>
          Your name <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div>
        <button type="button" disabled={busy} onClick={host}>
          Host a room
        </button>
      </div>
      <div>
        <label>
          Room code <input value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
      </div>
      <div>
        <button type="submit" disabled={busy}>
          Join room
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
