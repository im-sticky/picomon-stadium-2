"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  draftTurn,
  inDraftPool,
  PICKS_PER_PLAYER,
  picksLeftInTurn,
  teamLimitError,
  TOTAL_PICKS,
  type TeamLimitError,
} from "@/lib/draft";
import type { PoolPokemon } from "@/lib/draft-pool";
import type { DraftView, RoomState, Slot } from "@/lib/types";
import { BallIcon } from "@/app/ui/ball-icon";
import { Button } from "@/app/ui/button";
import { Frame } from "@/app/ui/frame";
import { HeldItem } from "@/app/ui/held-item";
import type { Message } from "@/app/ui/message-box";
import { PixelScroll } from "@/app/ui/pixel-scroll";
import { PokemonIcon } from "@/app/ui/pokemon-icon";
import { Stage } from "@/app/ui/stage";
import { TypeBadge } from "@/app/ui/type-badge";
import { DetailScreen } from "./detail-screen";
import type { RoomAction } from "./room-view";
import styles from "./draft.module.scss";

const PROMPT: Message = ["Hover a POKéMON to see its moves.", "Click one to see its details."];
const FAILED: Message = ["Something went wrong.", "Try again."];
const POKEBALL = "/sprites/misc/pokeball.png";
const BALL_ICON = "/sprites/misc/icon-pokeballball.png";
const LIMIT_REASONS: Record<TeamLimitError, string> = {
  "master-limit": "Only 1 master pokemon allowed.",
  "ultra-limit": "Only 1 ultra pokemon allowed.",
  "item-limit": "Item already used on team.",
};

/** Which Detail is open: a free Pokémon to rent, or a rented one to look at. */
type Open = { id: string; viewOnly: boolean };

/**
 * The draft: a snake draft of 12 picks (6 each) from the pool, with the Detail
 * screen for one Pokémon on top. The room's draft type sets the rules (a Poké Ball
 * draft shows only Poké Ball tier Pokémon). The server decides whose turn it is and
 * which picks are allowed; this screen only mirrors those rules to grey things out.
 */
export function DraftScreen({
  state,
  draft,
  pool,
  notice,
  onAction,
}: {
  state: RoomState;
  draft: DraftView;
  pool: readonly PoolPokemon[];
  notice?: Message;
  onAction: RoomAction;
}) {
  const { players, you, battleSize, draftType } = state;
  const { firstDrafter, picks } = draft;
  const [open, setOpen] = useState<Open | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Next keeps earlier routes alive in <Activity>; hiding runs effect cleanups, so
  // reset the screen then (it would otherwise come back mid-rent or on a Detail).
  useEffect(
    () => () => {
      setOpen(null);
      setHover(null);
      setBusy(false);
    },
    [],
  );

  const name = (slot: Slot) => (players.find((p) => p.slot === slot)?.name ?? "").toUpperCase();
  const byId = new Map(pool.map((p) => [p.id, p]));
  const grid = pool.filter((p) => inDraftPool(draftType, p));
  const rentedBy = new Map(picks.map((p) => [p.pokemonId, p.slot]));
  const team = (slot: Slot) => picks.filter((p) => p.slot === slot).map((p) => p.pokemonId);
  const turn = draftTurn(firstDrafter, picks.length);
  const done = picks.length >= TOTAL_PICKS;
  const left = picksLeftInTurn(firstDrafter, picks.length);
  const yourTeam = team(you.slot).map((id) => byId.get(id));
  /** Why one of your team's limits rules `p` out under this draft type, or null. */
  const limitReason = (p: PoolPokemon): string | null => {
    const error = teamLimitError(draftType, yourTeam, p);
    return error && LIMIT_REASONS[error];
  };
  const blocked = (p: PoolPokemon) => limitReason(p) !== null;
  /** Why the open Pokémon can't be rented, shown by RENT. Null while it can be (or mid-rent). */
  const notRentable = (p: PoolPokemon): string | null => {
    if (rentedBy.has(p.id)) return "Already drafted.";
    if (turn !== you.slot) return "Not your turn.";
    return limitReason(p);
  };
  // "YOUR" keeps your turns clear even when both players are the same trainer.
  const title = turn === you.slot ? "YOUR CHOICE" : turn ? `${name(turn)}'S CHOICE` : "DRAFT COMPLETE";

  async function rent(id: string) {
    setBusy(true);
    setFailed(false);
    const ok = await onAction("draft-pick", { pokemonId: id });
    setBusy(false);
    setOpen(null);
    if (!ok) {
      setHover(null);
      setFailed(true);
    }
  }

  async function startBattle() {
    setBusy(true);
    // On success stay busy: the room moves to the Battle order and this screen goes away.
    // The done box only holds the button, so a failure just lets the host try again.
    if (!(await onAction("battle"))) setBusy(false);
  }

  const opened = open && byId.get(open.id);
  if (open && opened) {
    const owner = rentedBy.get(opened.id);
    const reason = open.viewOnly ? null : notRentable(opened);
    return (
      <DetailScreen
        key={opened.id}
        pokemon={opened}
        title={open.viewOnly && owner ? `RENTED BY ${name(owner)}` : title}
        viewOnly={open.viewOnly}
        canRent={!open.viewOnly && !busy && reason === null}
        notRentable={reason}
        onRent={() => void rent(opened.id)}
        onBack={() => setOpen(null)}
      />
    );
  }

  const hovered = !done && hover ? byId.get(hover) : undefined;
  const hoveredBy = hovered && rentedBy.get(hovered.id);
  let message: Message | null = hovered ? null : PROMPT;
  if (failed) message = FAILED;
  if (notice) message = notice;

  const strip = (slot: Slot) => {
    const ids = team(slot);
    return (
      <div className={`${styles.draft__strip} ${slot === 2 ? styles["draft__strip--right"] : ""}`}>
        <p className={styles.draft__picksLeft} style={{ visibility: turn === slot ? "visible" : "hidden" }}>
          {left === 1 ? "1 PICK" : `${left} PICKS`}
        </p>
        <ul className={styles.draft__slots} aria-label={`${name(slot)}'s team`}>
          {Array.from({ length: PICKS_PER_PLAYER }, (_, i) => {
            const p = ids[i] ? byId.get(ids[i]) : undefined;
            return (
              <li key={i} className={styles.draft__slot}>
                {p ? (
                  <button
                    type="button"
                    className={styles.draft__slotButton}
                    aria-label={`View ${p.name.toUpperCase()}`}
                    onClick={() => setOpen({ id: p.id, viewOnly: true })}
                  >
                    <PokemonIcon src={p.sprite} size={64} />
                  </button>
                ) : (
                  <Image
                    className={`${styles.draft__ball} ${styles["draft__ball--empty"]} ${slot === 2 ? styles["draft__ball--p2"] : ""}`}
                    src={BALL_ICON}
                    alt="Empty slot"
                    width={32}
                    height={32}
                    unoptimized
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <Stage className={styles.draft}>
      <h1 className={styles.draft__title}>{title}</h1>
      <div className={styles.draft__teams}>
        {strip(1)}
        <p className={styles.draft__format} aria-label="Battle format">
          {battleSize}V{battleSize}
        </p>
        {strip(2)}
      </div>

      <PixelScroll label="Pokémon available to rent, scrollable" height={432} step={144}>
        <ul className={styles.draft__grid} aria-label="Pokémon available to rent">
          {grid.map((p) => {
            const owner = rentedBy.get(p.id);
            const label = p.name.toUpperCase();
            const on = !done && hover === p.id ? styles["draft__cell--active"] : "";
            if (owner) {
              return (
                <li key={p.id}>
                  <div className={`${styles.draft__cell} ${on}`} onMouseEnter={() => setHover(p.id)}>
                    <Image
                      className={`${styles.draft__ball} ${owner === 2 ? styles["draft__ball--p2"] : ""}`}
                      src={POKEBALL}
                      alt={`${label} rented by ${name(owner)}`}
                      width={96}
                      height={96}
                      unoptimized
                    />
                  </div>
                </li>
              );
            }
            if (done) {
              return (
                <li key={p.id}>
                  <div className={styles.draft__cell} aria-label={label}>
                    <PokemonIcon src={p.sprite} size={128} />
                  </div>
                </li>
              );
            }
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${styles.draft__cell} ${on} ${blocked(p) ? styles["draft__cell--blocked"] : ""}`}
                  aria-label={`View ${label}${blocked(p) ? ` (${limitReason(p)})` : ""}`}
                  onMouseEnter={() => setHover(p.id)}
                  onFocus={() => setHover(p.id)}
                  onClick={() => setOpen({ id: p.id, viewOnly: false })}
                >
                  <PokemonIcon src={p.sprite} size={128} />
                </button>
              </li>
            );
          })}
        </ul>
      </PixelScroll>

      <p className={styles.draft__hint} style={{ visibility: done ? "hidden" : "visible" }}>
        Hover for moves · Click for details
      </p>

      <Frame className={styles.draft__info}>
        {done && you.slot === 1 ? (
          <div className={styles.draft__done}>
            <Button primary disabled={busy} onClick={() => void startBattle()}>
              START BATTLE
            </Button>
          </div>
        ) : done ? (
          <div role="status">
            <p className={styles.draft__line}>Waiting for {name(1)}</p>
            <p className={styles.draft__line}>to start the battle...</p>
          </div>
        ) : message ? (
          <div role={notice || failed ? "alert" : "status"}>
            <p className={styles.draft__line}>{message[0]}</p>
            <p className={styles.draft__line}>{message[1]}</p>
          </div>
        ) : (
          hovered && (
            <div className={styles.draft__infoRow}>
              <div className={styles.draft__infoLeft}>
                <div className={styles.draft__infoName}>
                  <BallIcon pokemon={hovered} />
                  <p>{hovered.name.toUpperCase()}</p>
                </div>
                <div className={styles.draft__badges}>
                  {hovered.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
                <p className={styles.draft__ability} aria-label="Ability">
                  {hovered.ability.name}
                </p>
                <HeldItem item={hovered.item} />
              </div>
              <div className={styles.draft__infoRight}>
                {hoveredBy ? (
                  <p className={styles.draft__line}>Rented by {name(hoveredBy)}.</p>
                ) : (
                  <ul className={styles.draft__infoMoves} aria-label="Moves">
                    {hovered.moves.map((m) => (
                      <li key={m.name} className={styles.draft__infoMove}>
                        <span className={styles.draft__moveName}>{m.name.toUpperCase()}</span>
                        <span className={styles.draft__pp}>
                          PP {m.pp}/{m.pp}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        )}
      </Frame>
    </Stage>
  );
}
