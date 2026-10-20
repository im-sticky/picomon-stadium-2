"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/codes";
import { MAX_NAME_LENGTH, normalizeName } from "@/lib/names";
import { BATTLE_SIZES, DEFAULT_BATTLE_SIZE, type BattleSize } from "@/lib/types";
import { Button } from "./ui/button";
import { Field, SectionLabel } from "./ui/field";
import { Frame } from "./ui/frame";
import { MessageBox, type Message } from "./ui/message-box";
import { RadioGroup } from "./ui/radio-group";
import styles from "./home.module.css";

const SIZE_OPTIONS = BATTLE_SIZES.map((n) => ({ value: n, label: `${n}V${n}` }));

const HINT: Message = ["Enter your name, then host a", "room or join one with a code."];
const BAD_NAME: Message = ["Enter a name.", `It can be 1-${MAX_NAME_LENGTH} characters.`];
const BAD_CODE: Message = ["Enter a 4-character", "room code."];
const NOT_FOUND: Message = ["Room not found.", "Check the code and try again."];
const FAILED: Message = ["Something went wrong.", "Try again."];

export function HomeForm({ initialError }: { initialError?: "not-found" }) {
  const router = useRouter();
  const nameId = useId();
  const codeId = useId();
  const initialMessage = initialError === "not-found" ? NOT_FOUND : undefined;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [battleSize, setBattleSize] = useState<BattleSize>(DEFAULT_BATTLE_SIZE);
  const [error, setError] = useState<Message | undefined>(initialMessage);
  const [busy, setBusy] = useState(false);

  // Show a changed initialError: adjust state during render (not in an effect).
  const [seenInitialError, setSeenInitialError] = useState(initialError);
  if (seenInitialError !== initialError) {
    setSeenInitialError(initialError);
    setError(initialMessage);
  }

  // Next keeps earlier routes alive in <Activity>; hiding runs effect cleanups, so
  // clear a stale busy flag then (it would otherwise stay disabled when re-shown).
  useEffect(() => () => setBusy(false), []);

  async function submit(url: string, body: { name: string; battleSize?: BattleSize }) {
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
      if (res.status === 404) setError(NOT_FOUND);
      else if (res.status === 409) setError([data?.error ?? "Something went wrong.", ""]);
      else setError(FAILED);
    } catch {
      setError(FAILED);
    }
    setBusy(false);
  }

  function host() {
    const n = normalizeName(name);
    if (!n) return setError(BAD_NAME);
    void submit("/api/rooms", { name: n, battleSize });
  }

  function join() {
    const n = normalizeName(name);
    if (!n) return setError(BAD_NAME);
    const trimmed = code.trim();
    if (trimmed.length !== 4) return setError(BAD_CODE);
    const c = normalizeCode(trimmed);
    if (!c) return setError(NOT_FOUND);
    void submit(`/api/rooms/${c}/join`, { name: n });
  }

  return (
    <>
      <Frame
        as="form"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) join();
        }}
      >
        <div>
          <SectionLabel htmlFor={nameId}>NAME</SectionLabel>
          <Field
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            placeholder="YOUR NAME"
            autoComplete="off"
          />
        </div>
        <div className={styles.columns}>
          <div className={styles.column}>
            <div>
              <SectionLabel>NEW ROOM</SectionLabel>
              <p className={styles.blurb}>Host a room and share its code.</p>
            </div>
            <Button primary disabled={busy} onClick={host}>
              HOST
            </Button>
            <RadioGroup
              label="Battle size"
              name="battle-size"
              options={SIZE_OPTIONS}
              value={battleSize}
              onChange={setBattleSize}
            />
          </div>
          <div className={styles.column}>
            <div>
              <SectionLabel htmlFor={codeId}>ROOM CODE</SectionLabel>
              <Field
                id={codeId}
                className={styles.code}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={4}
                placeholder="----"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={busy}>
              JOIN
            </Button>
          </div>
        </div>
      </Frame>
      <MessageBox className={styles.message} message={error ?? HINT} />
    </>
  );
}
