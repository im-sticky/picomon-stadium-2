"use client";

import { useEffect, useRef, useState } from "react";
import {
  BATTLE_SIZES,
  DRAFT_TYPE_LABELS,
  DRAFT_TYPE_OPTION_LABELS,
  DRAFT_TYPES,
  type BattleSize,
  type DraftType,
  type RoomState,
  type Slot,
} from "@/lib/types";
import { Button, ButtonLink } from "@/app/ui/button";
import { SectionLabel } from "@/app/ui/field";
import { Frame } from "@/app/ui/frame";
import { MessageBox, type Message } from "@/app/ui/message-box";
import { RadioGroup } from "@/app/ui/radio-group";
import { Stage } from "@/app/ui/stage";
import { VisuallyHidden } from "@/app/ui/visually-hidden";
import type { RoomAction } from "./room-view";
import styles from "./lobby.module.scss";

const SIZE_OPTIONS = [...BATTLE_SIZES].reverse().map((n) => ({ value: n, label: `${n}V${n}` }));
const DRAFT_OPTIONS = DRAFT_TYPES.map((t) => ({ value: t, label: DRAFT_TYPE_OPTION_LABELS[t] }));

const WAITING: Message = ["Send this code to a friend.", "Waiting for an opponent..."];
const CONNECTED: Message = ["Both players connected!", "Ready to battle?"];
const OPTIONS_CHANGED: Message = ["Battle options changed.", "Ready up again."];
const FAILED: Message = ["Something went wrong.", "Try again."];

/** The start request goes this long after the countdown ends, so the server agrees it's due. */
const START_DELAY_MS = 100;
/** A failed start is retried once, this long after. */
const START_RETRY_MS = 500;

type Options = { battleSize: BattleSize; draftType: DraftType };

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
  const { code, players, you, lobby } = state;
  const me = you.slot;
  const opp: Slot = me === 1 ? 2 : 1;
  const isHost = me === 1;
  const host = players.find((p) => p.slot === 1);
  const guest = players.find((p) => p.slot === 2);
  const full = players.length >= 2;
  const ready = { 1: full && !!lobby?.ready[1], 2: full && !!lobby?.ready[2] };
  const meReady = ready[me];
  const oppReady = ready[opp];
  const startAt = meReady && oppReady ? (lobby?.startAt ?? null) : null;
  const oppName = (players.find((p) => p.slot === opp)?.name ?? "").toUpperCase();

  const [failed, setFailed] = useState(false);

  // The host's pick shows at once, until the server's answer replaces it.
  const [pending, setPending] = useState<Options | null>(null);
  const optionsRequest = useRef(0);
  const options: Options = pending ?? { battleSize: state.battleSize, draftType: state.draftType };

  async function changeOptions(next: Options) {
    const id = ++optionsRequest.current;
    setPending(next);
    setFailed(false);
    const ok = await onAction("options", next);
    // A later change is in flight: it owns the pending value.
    if (id !== optionsRequest.current) return;
    setPending(null);
    if (!ok) setFailed(true);
  }

  // Not `disabled` while a request is in flight, so keyboard focus stays on READY.
  const readyBusy = useRef(false);
  // Next keeps earlier routes alive in <Activity>; clear a stale busy flag when hidden.
  useEffect(
    () => () => {
      readyBusy.current = false;
    },
    [],
  );

  async function toggleReady() {
    if (readyBusy.current) return;
    readyBusy.current = true;
    setFailed(false);
    const ok = await onAction("ready", { ready: !meReady });
    readyBusy.current = false;
    if (!ok) setFailed(true);
  }

  const secondsLeft = useCountdown(startAt, lobby?.serverNow ?? null, onAction, () => setFailed(true));

  let message: Message;
  if (notice) message = notice;
  else if (failed) message = FAILED;
  else if (!full) message = WAITING;
  else if (secondsLeft !== null) message = ["Both players ready!", `Starting in ${secondsLeft}...`];
  else if (lobby?.optionsChanged && !meReady) message = OPTIONS_CHANGED;
  else if (meReady) message = [`Waiting for ${oppName}`, "to get ready..."];
  else if (oppReady) message = [`${oppName} is ready!`, "Ready to battle?"];
  else message = CONNECTED;

  return (
    <Stage className={styles.lobby}>
      <h1 className={styles.lobby__title}>{full ? `ROOM ${code}` : "WAITING ROOM"}</h1>

      <Frame as="section" aria-label="Room code" className={`${styles.lobby__panel} ${styles.lobby__codePanel}`}>
        <div>
          <p className={styles.lobby__codeLabel}>ROOM CODE</p>
          <span className={styles.lobby__code}>{code}</span>
        </div>
        {/* The host changes these until the battle starts; the guest sees them read-only. */}
        <div className={styles.lobby__options} aria-label="Battle size and draft type">
          {isHost ? (
            <div className={styles.lobby__optionColumns}>
              <RadioGroup
                label="BATTLE TYPE"
                name="battle-size"
                options={SIZE_OPTIONS}
                value={options.battleSize}
                onChange={(battleSize) => void changeOptions({ ...options, battleSize })}
                vertical
                titled
              />
              <RadioGroup
                label="DRAFT TYPE"
                name="draft-type"
                options={DRAFT_OPTIONS}
                value={options.draftType}
                onChange={(draftType) => void changeOptions({ ...options, draftType })}
                vertical
                titled
              />
            </div>
          ) : (
            <div className={styles.lobby__guestOptions}>
              <p className={`${styles.lobby__guestRow} ${styles["lobby__guestRow--size"]}`}>
                {state.battleSize}V{state.battleSize}
              </p>
              <p className={styles.lobby__guestRow}>{DRAFT_TYPE_LABELS[state.draftType]}</p>
            </div>
          )}
        </div>
      </Frame>

      <Frame as="section" aria-label="Players" className={styles.lobby__panel}>
        <SectionLabel>PLAYERS</SectionLabel>
        <ul className={styles.lobby__players}>
          <li className={styles.lobby__player}>
            <span className={`${styles.lobby__slot} ${styles["lobby__slot--p1"]}`}>P1</span>
            <PlayerName name={host?.name} />
            {ready[1] && <ReadyTick />}
            {host && <span className={styles.lobby__tag}>HOST</span>}
          </li>
          <li className={styles.lobby__player}>
            <span className={`${styles.lobby__slot} ${styles["lobby__slot--p2"]}`}>P2</span>
            <PlayerName name={guest?.name} />
            {ready[2] && <ReadyTick />}
          </li>
        </ul>
      </Frame>

      <MessageBox message={message} role={notice || failed ? "alert" : "status"} />

      <div className={styles.lobby__buttons}>
        <Button
          primary={!meReady}
          className={styles.lobby__readyButton}
          disabled={!full}
          onClick={() => void toggleReady()}
        >
          {meReady ? "CANCEL READY" : "READY"}
        </Button>
        <ButtonLink href={`/room/${code}/rules`}>DRAFT RULES</ButtonLink>
      </div>
    </Stage>
  );
}

/**
 * The countdown to `startAt` (server time) once both players are ready: the seconds
 * left (never 0), or null when there's none. `serverNow` is the server's clock when
 * that state was read, for the offset. When it's due, asks the server to start
 * (retrying once); the server decides, so this timer never starts anything itself.
 */
function useCountdown(
  startAt: number | null,
  serverNow: number | null,
  onAction: RoomAction,
  onFailed: () => void,
): number | null {
  // Seconds left, from the last tick for this `startAt`.
  const [tick, setTick] = useState<{ startAt: number; left: number } | null>(null);
  const failedRef = useRef(onFailed);
  useEffect(() => {
    failedRef.current = onFailed;
  });

  useEffect(() => {
    if (startAt === null || serverNow === null) return;
    // Local time the countdown ends: the server's startAt, less its clock's lead.
    const due = startAt - (serverNow - Date.now());
    let cancelled = false;
    const update = () => setTick({ startAt, left: Math.max(1, Math.ceil((due - Date.now()) / 1000)) });
    const interval = setInterval(update, 250);
    let retry: ReturnType<typeof setTimeout> | undefined;
    const fire = setTimeout(
      async () => {
        // On success the room moves to the type battle and this screen goes away.
        if ((await onAction("start")) || cancelled) return;
        retry = setTimeout(async () => {
          if (!(await onAction("start")) && !cancelled) failedRef.current();
        }, START_RETRY_MS);
      },
      Math.max(0, due + START_DELAY_MS - Date.now()),
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(fire);
      clearTimeout(retry);
    };
  }, [startAt, serverNow, onAction]);

  if (startAt === null || serverNow === null) return null;
  if (tick?.startAt === startAt) return tick.left;
  return Math.max(1, Math.ceil((startAt - serverNow) / 1000));
}

/** The green pixel checkmark beside a READY player's name. */
function ReadyTick() {
  return (
    <svg
      className={styles.lobby__tick}
      width="24"
      height="24"
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Ready"
    >
      <path d="M7 1h1v1h-1z M6 2h2v1h-2z M0 3h1v1h-1z M5 3h2v1h-2z M0 4h2v1h-2z M4 4h2v1h-2z M1 5h4v1h-4z M2 6h2v1h-2z" />
    </svg>
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
