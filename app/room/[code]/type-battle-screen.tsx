"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { TYPE_CHOICES, type RoomState, type Slot, type TypeBattleView, type TypeChoice } from "@/lib/types";
import { Button } from "@/app/ui/button";
import { MessageBox, type Message } from "@/app/ui/message-box";
import { Stage } from "@/app/ui/stage";
import type { RoomAction } from "./room-view";
import styles from "./room.module.css";

const CHOOSE: Message = ["Choose a type.", "Winner chooses the draft order."];
const FAILED: Message = ["Something went wrong.", "Try again."];

const label = (type: TypeChoice) => type.toUpperCase();

/**
 * "Who picks first": both players secretly pick Grass, Water or Fire. The server
 * reveals both picks once they're in; the winner then chooses the draft order.
 * Remount it per round (key it by round) so a new round starts with clean local state.
 */
export function TypeBattleScreen({
  state,
  battle,
  notice,
  onAction,
}: {
  state: RoomState;
  battle: TypeBattleView;
  notice?: Message;
  onAction: RoomAction;
}) {
  const { players, you } = state;
  // Shown as picked while the pick is being sent.
  const [pending, setPending] = useState<TypeChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Next keeps earlier routes alive in <Activity>; hiding runs effect cleanups, so
  // clear in-flight flags then (they would otherwise stick when re-shown).
  useEffect(
    () => () => {
      setPending(null);
      setBusy(false);
    },
    [],
  );

  const name = (slot: Slot) => (players.find((p) => p.slot === slot)?.name ?? "").toUpperCase();
  const yourPick = battle.yourPick ?? pending;
  const done = battle.yourPick !== null && battle.opponentPick !== null;
  const picks: Record<Slot, TypeChoice | null> =
    you.slot === 1 ? { 1: yourPick, 2: battle.opponentPick } : { 1: battle.opponentPick, 2: yourPick };
  const { winner, firstDrafter } = battle;
  const draw = done && winner === null;
  const youWon = winner === you.slot;
  const choosingOrder = youWon && firstDrafter === null;

  // On success stay busy: the refetched state replaces the buttons.
  async function run(action: string, body: object) {
    setBusy(true);
    setFailed(false);
    if (await onAction(action, body)) return;
    setBusy(false);
    setFailed(true);
  }

  async function pick(type: TypeChoice) {
    if (yourPick) return;
    setPending(type);
    setFailed(false);
    if (await onAction("type-pick", { type })) return;
    setPending(null);
    setFailed(true);
  }

  let message = CHOOSE;
  if (winner !== null && done) {
    const loser: Slot = winner === 1 ? 2 : 1;
    const beats = `${label(picks[winner]!)} beats ${label(picks[loser]!)}!`;
    if (firstDrafter !== null) message = [beats, `${name(firstDrafter)} drafts first.`];
    else if (youWon) message = [beats, "Pick FIRST or SECOND?"];
    else message = [beats, `${name(winner)} is choosing the order...`];
  } else if (draw) {
    message = [`Both chose ${label(yourPick!)}!`, "Choose again."];
  }
  if (failed) message = FAILED;
  if (notice) message = notice;

  let actions = null;
  if (draw) {
    actions = (
      <Button disabled={busy} onClick={() => void run("again", { round: battle.round })}>
        AGAIN
      </Button>
    );
  } else if (choosingOrder) {
    actions = (
      <div role="group" aria-label="Draft order" className={styles.orderButtons}>
        <Button primary className={styles.orderButton} disabled={busy} onClick={() => void run("order", { order: "first" })}>
          FIRST
        </Button>
        <Button className={styles.orderButton} disabled={busy} onClick={() => void run("order", { order: "second" })}>
          SECOND
        </Button>
      </div>
    );
  }

  return (
    <Stage className={styles.battle}>
      <h1 className={styles.title}>CHOOSE A TYPE</h1>
      <div className={styles.battleRow}>
        <TypeColumn
          side="left"
          name={name(1)}
          isYou={you.slot === 1}
          pick={picks[1]}
          revealed={done}
          disabled={yourPick !== null}
          onPick={pick}
        />
        <div className={styles.centre}>
          {done && winner !== null && <p>{name(winner)}</p>}
          <p>{done ? (winner !== null ? "WINS!" : "DRAW!") : yourPick ? ". . ." : "VS"}</p>
        </div>
        <TypeColumn
          side="right"
          name={name(2)}
          isYou={you.slot === 2}
          pick={picks[2]}
          revealed={done}
          disabled={yourPick !== null}
          onPick={pick}
        />
      </div>
      <MessageBox
        message={message}
        role={notice || failed ? "alert" : "status"}
        className={`${styles.battleMessage} ${choosingOrder ? styles.orderMessage : ""}`}
        actions={actions}
      />
    </Stage>
  );
}

/** One player's column. Only the viewer's own column is clickable. */
function TypeColumn({
  side,
  name,
  isYou,
  pick,
  revealed,
  disabled,
  onPick,
}: {
  side: "left" | "right";
  name: string;
  isYou: boolean;
  pick: TypeChoice | null;
  /** Both picks are in, so the opponent's pick can be shown. */
  revealed: boolean;
  disabled: boolean;
  onPick: (type: TypeChoice) => void;
}) {
  return (
    <section aria-label={name} className={`${styles.column} ${side === "right" ? styles.columnRight : ""}`}>
      <h2 className={styles.columnName}>
        {name} {isYou && <span className={styles.you}>YOU</span>}
      </h2>
      {TYPE_CHOICES.map((type) => {
        const shown = isYou || revealed ? pick : null;
        const cls = [
          styles.option,
          side === "right" && styles.optionRight,
          shown === type && styles.selected,
          (isYou ? pick !== null && pick !== type : shown !== type) && styles.dim,
        ]
          .filter(Boolean)
          .join(" ");
        // Right-hand options are mirrored in CSS (label first, badge on the outside).
        const children = (
          <>
            <Image
              className={styles.badge}
              src={`/sprites/misc/badge-${type}.png`}
              alt=""
              width={96}
              height={96}
              unoptimized
            />
            <span>{label(type)}</span>
          </>
        );
        return isYou ? (
          <button
            key={type}
            type="button"
            className={cls}
            disabled={disabled}
            aria-label={`Choose ${label(type)}`}
            aria-pressed={pick === type}
            onClick={() => onPick(type)}
          >
            {children}
          </button>
        ) : (
          <div key={type} className={cls}>
            {children}
          </div>
        );
      })}
    </section>
  );
}
