"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomState } from "@/lib/types";
import { Button } from "@/app/ui/button";
import { SectionLabel } from "@/app/ui/field";
import { Frame } from "@/app/ui/frame";
import { MessageBox, type Message } from "@/app/ui/message-box";
import { Stage } from "@/app/ui/stage";
import { VisuallyHidden } from "@/app/ui/visually-hidden";
import styles from "./room.module.css";

const WAITING: Message = ["Send this code to a friend.", "Waiting for PLAYER 2..."];
const FULL_HOST: Message = ["Both players connected!", "Ready to battle?"];
const FULL_GUEST: Message = ["Both players connected!", "Waiting for PLAYER 1..."];

/** `notice` replaces the message box text (e.g. a realtime failure). */
export function RoomScreen({ state, notice }: { state: RoomState; notice?: Message }) {
  const { code, players, you } = state;
  const host = players.find((p) => p.slot === 1);
  const guest = players.find((p) => p.slot === 2);
  const full = players.length >= 2;
  const isHost = you.slot === 1;
  const fullMessage = isHost ? FULL_HOST : FULL_GUEST;

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

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
    <Stage className={styles.stage}>
      <h1 className={styles.title}>{full ? `ROOM ${code}` : "WAITING ROOM"}</h1>

      <Frame as="section" aria-label="Room code" className={styles.panel}>
        <SectionLabel>ROOM CODE</SectionLabel>
        <div className={styles.codeRow}>
          <VisuallyHidden>{code}</VisuallyHidden>
          {[...code].map((ch, i) => (
            <Frame as="span" key={i} className={styles.cell} aria-hidden="true">
              {ch}
            </Frame>
          ))}
          {!full && (
            <Button className={styles.copy} onClick={copy}>
              {copied ? "COPIED!" : "COPY"}
            </Button>
          )}
        </div>
      </Frame>

      <Frame as="section" aria-label="Players" className={styles.panel}>
        <SectionLabel>PLAYERS</SectionLabel>
        <ul className={styles.players}>
          <li className={styles.player}>
            <span className={styles.p1}>P1</span>
            <PlayerName name={host?.name} />
            {host && <span className={styles.tag}>HOST</span>}
          </li>
          <li className={styles.player}>
            <span className={styles.p2}>P2</span>
            <PlayerName name={guest?.name} />
          </li>
        </ul>
      </Frame>

      <MessageBox message={notice ?? (full ? fullMessage : WAITING)} role={notice ? "alert" : "status"} />

      {full && isHost && (
        <div className={styles.start}>
          {/* No action yet: the type battle screen doesn't exist. */}
          <Button primary className={styles.startButton}>
            START BATTLE
          </Button>
        </div>
      )}
    </Stage>
  );
}

function PlayerName({ name }: { name?: string }) {
  if (name) return <span className={styles.name}>{name}</span>;
  return (
    <span className={`${styles.name} ${styles.empty}`}>
      <span aria-hidden="true">- - - - - -</span>
      <VisuallyHidden>Waiting</VisuallyHidden>
    </span>
  );
}
