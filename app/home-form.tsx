"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/codes";
import { normalizeName } from "@/lib/names";

export function HomeForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [busy, setBusy] = useState(false);

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
    const c = normalizeCode(code);
    if (!c) return setError("Enter a 4-character room code.");
    void submit(`/api/rooms/${c}/join`, { name: n });
  }

  return (
    <div>
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
        <button type="button" disabled={busy} onClick={join}>
          Join room
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
