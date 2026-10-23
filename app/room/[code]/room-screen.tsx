"use client";

import { useEffect, useRef, useState } from "react";
import { DRAFT_TYPE_LABELS, type RoomState } from "@/lib/types";
import { Button } from "@/app/ui/button";
import { SectionLabel } from "@/app/ui/field";
import { Frame } from "@/app/ui/frame";
import { MessageBox, type Message } from "@/app/ui/message-box";
import { Stage } from "@/app/ui/stage";
import { VisuallyHidden } from "@/app/ui/visually-hidden";
import type { RoomAction } from "./room-view";
import styles from "./lobby.module.scss";

const WAITING: Message = ["Send this code to a friend.", "Waiting for an opponent..."];
const FULL_HOST: Message = ["Both players connected!", "Ready to battle?"];
const fullGuest = (host: string): Message => ["Both players connected!", `Waiting for ${host}...`];
const FAILED: Message = ["Something went wrong.", "Try again."];

/** `notice` replaces the message box text (e.g. a realtime failure). */
export function RoomScreen({
  state,
  notice,
  onAction,
}: {
  state: RoomState;
  notice?: Message;
  onAction: RoomAction;
}) {
  const { code, players, you, battleSize, draftType } = state;
  const host = players.find((p) => p.slot === 1);
  const guest = players.find((p) => p.slot === 2);
  const full = players.length >= 2;
  const isHost = you.slot === 1;
  const fullMessage = isHost ? FULL_HOST : fullGuest((host?.name ?? "").toUpperCase());

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  // Next keeps earlier routes alive in <Activity>; clear a stale busy flag when hidden.
  useEffect(() => () => setStarting(false), []);

  async function start() {
    setStarting(true);
    setStartFailed(false);
    // On success stay busy: the room moves to the type battle and this screen goes away.
    if (await onAction("start")) return;
    setStarting(false);
    setStartFailed(true);
  }

  function copy() {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <Stage className={styles.lobby}>
      <h1 className={styles.lobby__title}>{full ? `ROOM ${code}` : "WAITING ROOM"}</h1>

      <Frame as="section" aria-label="Room code" className={styles.lobby__panel}>
        <SectionLabel>ROOM CODE</SectionLabel>
        <div className={styles.lobby__codeRow}>
          <VisuallyHidden>{code}</VisuallyHidden>
          {[...code].map((ch, i) => (
            <span key={i} className={styles.lobby__codeCell} aria-hidden="true">
              {ch}
            </span>
          ))}
          {!full && (
            <Button className={styles.lobby__copy} onClick={copy}>
              {copied ? "COPIED!" : "COPY"}
            </Button>
          )}
          {/* The host's choices from Home. */}
          <div className={styles.lobby__settings} aria-label="Battle size and draft type">
            <p className={styles.lobby__format}>
              {battleSize}V{battleSize}
            </p>
            <p className={styles.lobby__draftType}>{DRAFT_TYPE_LABELS[draftType]}</p>
          </div>
        </div>
      </Frame>

      <Frame as="section" aria-label="Players" className={styles.lobby__panel}>
        <SectionLabel>PLAYERS</SectionLabel>
        <ul className={styles.lobby__players}>
          <li className={styles.lobby__player}>
            <span className={`${styles.lobby__slot} ${styles["lobby__slot--p1"]}`}>P1</span>
            <PlayerName name={host?.name} />
            {host && <span className={styles.lobby__tag}>HOST</span>}
          </li>
          <li className={styles.lobby__player}>
            <span className={`${styles.lobby__slot} ${styles["lobby__slot--p2"]}`}>P2</span>
            <PlayerName name={guest?.name} />
          </li>
        </ul>
      </Frame>

      <MessageBox
        message={notice ?? (startFailed ? FAILED : full ? fullMessage : WAITING)}
        role={notice || startFailed ? "alert" : "status"}
      />

      {full && isHost && (
        <div className={styles.lobby__start}>
          <Button primary className={styles.lobby__startButton} disabled={starting} onClick={() => void start()}>
            START BATTLE
          </Button>
        </div>
      )}
    </Stage>
  );
}

function PlayerName({ name }: { name?: string }) {
  if (name) return <span className={styles.lobby__name}>{name}</span>;
  return (
    <span className={`${styles.lobby__name} ${styles["lobby__name--empty"]}`}>
      <span aria-hidden="true">- - - - - -</span>
      <VisuallyHidden>Waiting</VisuallyHidden>
    </span>
  );
}
