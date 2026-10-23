"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/codes";
import { trainerName, trainerSprite, type Trainer } from "@/lib/trainers";
import {
  BATTLE_SIZES,
  DEFAULT_BATTLE_SIZE,
  DEFAULT_DRAFT_TYPE,
  DRAFT_TYPE_LABELS,
  DRAFT_TYPES,
  type BattleSize,
  type DraftType,
} from "@/lib/types";
import { useTrainer } from "./trainer-store";
import { Button, ButtonLink } from "./ui/button";
import { Field, SectionLabel } from "./ui/field";
import { Frame } from "./ui/frame";
import { MessageBox, type Message } from "./ui/message-box";
import { RadioGroup } from "./ui/radio-group";
import styles from "./home.module.scss";

const SIZE_OPTIONS = BATTLE_SIZES.map((n) => ({ value: n, label: `${n}V${n}` }));
const DRAFT_OPTIONS = DRAFT_TYPES.map((t) => ({ value: t, label: DRAFT_TYPE_LABELS[t] }));

const HINT: Message = ["Host a room, or enter a", "room code to join one."];
const BAD_CODE: Message = ["Enter a 4-character", "room code."];
const NOT_FOUND: Message = ["Room not found.", "Check the code and try again."];
const FAILED: Message = ["Something went wrong.", "Try again."];

export function HomeForm({ initialError }: { initialError?: "not-found" }) {
  const router = useRouter();
  const codeId = useId();
  const initialMessage = initialError === "not-found" ? NOT_FOUND : undefined;
  // Your trainer's name is your player name. Null until the browser's choice is read.
  const trainer = useTrainer();
  const [code, setCode] = useState("");
  const [battleSize, setBattleSize] = useState<BattleSize>(DEFAULT_BATTLE_SIZE);
  const [draftType, setDraftType] = useState<DraftType>(DEFAULT_DRAFT_TYPE);
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

  async function submit(url: string, body: { trainer: Trainer; battleSize?: BattleSize; draftType?: DraftType }) {
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
    if (!trainer) return;
    void submit("/api/rooms", { trainer, battleSize, draftType });
  }

  function join() {
    if (!trainer) return;
    const trimmed = code.trim();
    if (trimmed.length !== 4) return setError(BAD_CODE);
    const c = normalizeCode(trimmed);
    if (!c) return setError(NOT_FOUND);
    void submit(`/api/rooms/${c}/join`, { trainer });
  }

  return (
    <>
      <Frame
        as="form"
        className={styles.homeForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) join();
        }}
      >
        <div className={styles.homeForm__column}>
          <div>
            <SectionLabel>NEW ROOM</SectionLabel>
            <p className={styles.homeForm__blurb}>Host a room and share its code.</p>
          </div>
          <Button primary disabled={busy || !trainer} onClick={host}>
            HOST
          </Button>
          <RadioGroup
            label="Battle size"
            name="battle-size"
            options={SIZE_OPTIONS}
            value={battleSize}
            onChange={setBattleSize}
          />
          <RadioGroup
            label="Draft type"
            name="draft-type"
            options={DRAFT_OPTIONS}
            value={draftType}
            onChange={setDraftType}
            vertical
          />
        </div>
        <div className={styles.homeForm__column}>
          <div>
            <SectionLabel htmlFor={codeId}>ROOM CODE</SectionLabel>
            <Field
              id={codeId}
              className={styles.homeForm__code}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={4}
              placeholder="----"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={busy || !trainer}>
            JOIN
          </Button>
          {/* At the bottom of the column, level with CHANGE. */}
          <ButtonLink href="/rules" className={styles.homeForm__rules}>
            RULES
          </ButtonLink>
        </div>
        <section aria-label="Your trainer" className={styles.homeForm__column}>
          <div>
            <SectionLabel>TRAINER</SectionLabel>
            <p className={styles.homeForm__trainerName}>{trainer ? trainerName(trainer) : ""}</p>
            <Frame className={styles.homeForm__trainerFrame}>
              {trainer && (
                <Image
                  className={styles.homeForm__trainerSprite}
                  src={trainerSprite(trainer)}
                  alt={trainerName(trainer)}
                  width={168}
                  height={168}
                  unoptimized
                />
              )}
            </Frame>
          </div>
          <ButtonLink href="/trainers">CHANGE</ButtonLink>
        </section>
      </Frame>
      <MessageBox className={styles.homeForm__message} message={error ?? HINT} />
    </>
  );
}
