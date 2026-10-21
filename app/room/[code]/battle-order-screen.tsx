"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { BattleEvent, BattleView } from "@/lib/battle-types";
import type { PoolPokemon } from "@/lib/draft-pool";
import type { DraftView, RoomState, Slot } from "@/lib/types";
import { MessageBox, type Message } from "@/app/ui/message-box";
import { PokemonIcon } from "@/app/ui/pokemon-icon";
import { Stage } from "@/app/ui/stage";
import type { SubscribeBattle } from "./room-view";
import styles from "./battle-order.module.scss";

const CHOOSING: Message = ["Choose the order of your team.", ""];
const LOCKED: Message = ["Locked in!", "Waiting to start..."];
const FAILED: Message = ["Something went wrong.", "Try again."];
const BALL_ICON = "/sprites/misc/icon-pokeballball.png";

type OrderProgress = Extract<BattleEvent, { kind: "battle-order-progress" }>;

/** A `battle-order-progress` event in an Ably message's data, or null. */
export function parseOrderProgress(data: unknown): OrderProgress | null {
  const d = data as Record<string, unknown> | null;
  if (d?.kind !== "battle-order-progress") return null;
  if ((d.slot !== 1 && d.slot !== 2) || !Number.isInteger(d.count)) return null;
  return { kind: d.kind, slot: d.slot, count: d.count as number };
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const startsWith = (a: number[], prefix: number[]) => prefix.every((v, i) => a[i] === v);

/**
 * The Battle order (boards 3a/3b): each player picks which of their 6 drafted
 * Pokémon go into battle, lead first. Every click sends the order so far; the
 * opponent's progress shows as solid pokéballs, never their Pokémon.
 */
export function BattleOrderScreen({
  state,
  draft,
  pool,
  notice,
  subscribeBattle,
}: {
  state: RoomState;
  draft: DraftView;
  pool: readonly PoolPokemon[];
  notice?: Message;
  subscribeBattle: SubscribeBattle;
}) {
  const { code, players, you, battleSize } = state;
  const opponent: Slot = you.slot === 1 ? 2 : 1;
  const byId = new Map(pool.map((p) => [p.id, p]));
  const team = (slot: Slot) => draft.picks.filter((p) => p.slot === slot).map((p) => byId.get(p.pokemonId)!);
  const name = (slot: Slot) => (players.find((p) => p.slot === slot)?.name ?? "").toUpperCase();

  // Your order as 1-based draft positions, including picks not yet confirmed by the server.
  const [yours, setYours] = useState<number[]>([]);
  const [opponentCount, setOpponentCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const order = useRef<number[]>([]);
  const confirmed = useRef<number[]>([]);
  const sending = useRef(false);

  const setOrder = (next: number[]) => {
    order.current = next;
    setYours(next);
  };

  /** Takes the server's view, keeping any local picks that extend it. */
  const applyView = useCallback(
    (view: BattleView) => {
      const server = view.order?.yours ?? lockedOrder(view, draft, you.slot, battleSize);
      confirmed.current = server;
      if (!startsWith(order.current, server)) setOrder(server);
      const theirs = view.order ? view.order.opponentCount : battleSize;
      setOpponentCount((count) => Math.max(count, theirs));
      setLoaded(true);
    },
    [draft, you.slot, battleSize],
  );

  // A failed fetch is left for the next reconnect or tab switch to retry.
  const resync = useCallback(
    () =>
      fetch(`/api/rooms/${code}/battle`)
        .then((res) => (res.ok ? (res.json() as Promise<BattleView>) : null))
        .then((view) => view && applyView(view))
        .catch(() => {}),
    [code, applyView],
  );

  // Next keeps earlier routes alive in <Activity>; hiding runs effect cleanups, so
  // clear the in-flight flag then, and resync when shown again.
  useEffect(() => {
    void resync();
    const unsubscribe = subscribeBattle((event) => {
      if (!event) void resync();
      else if (event.kind === "battle-order-progress" && event.slot === opponent) {
        setOpponentCount((count) => Math.max(count, event.count));
      }
    });
    return () => {
      unsubscribe();
      sending.current = false;
    };
  }, [resync, subscribeBattle, opponent]);

  /** Sends the order so far until the server has all of it. One request at a time. */
  async function flush() {
    if (sending.current) return;
    sending.current = true;
    try {
      while (sending.current && !same(order.current, confirmed.current)) {
        const sent = order.current;
        const res = await fetch(`/api/rooms/${code}/battle/order`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: sent }),
        });
        const body = (await res.json().catch(() => null)) as { view?: BattleView } | null;
        if (res.ok) {
          confirmed.current = sent;
          continue;
        }
        // order-conflict / not-ordering carry the server's view; anything else, fetch it.
        if (body?.view) applyView(body.view);
        else await resync();
        if (res.status !== 409) setFailed(true);
        setOrder(confirmed.current);
        break;
      }
    } catch {
      setFailed(true);
      await resync();
      setOrder(confirmed.current);
    } finally {
      sending.current = false;
    }
  }

  // Past the Battle order (both locked in, or the deadline passed) there's nothing left to pick.
  const locked = yours.length >= battleSize || (state.battle !== null && state.battle.stage !== "team-order");

  function pick(position: number) {
    if (!loaded || locked || order.current.includes(position)) return;
    setFailed(false);
    setOrder([...order.current, position]);
    void flush();
  }

  let message = locked ? LOCKED : CHOOSING;
  if (failed && !locked) message = FAILED;
  if (notice) message = notice;

  const column = (slot: Slot) => {
    const isYou = slot === you.slot;
    const right = slot === 2;
    const members = team(slot);
    const ball = `${styles.battleOrder__ball} ${right ? styles["battleOrder__ball--p2"] : ""}`;
    return (
      <section
        aria-label={name(slot)}
        className={`${styles.battleOrder__column} ${right ? styles["battleOrder__column--right"] : ""}`}
      >
        <h2 className={styles.battleOrder__name}>
          {name(slot)} {isYou && <span className={styles.battleOrder__you}>YOU</span>}
        </h2>
        <ul className={styles.battleOrder__slots} aria-label={isYou ? "Your battle order" : "Opponent's battle order"}>
          {Array.from({ length: battleSize }, (_, k) => {
            const chosen = isYou && yours[k] ? members[yours[k] - 1] : undefined;
            const filled = !isYou && k < opponentCount;
            return (
              <li key={k} className={styles.battleOrder__slot}>
                {chosen ? (
                  <PokemonIcon src={chosen.sprite} size={64} alt={`${k + 1}. ${chosen.name.toUpperCase()}`} />
                ) : (
                  <Image
                    className={`${ball} ${filled ? "" : styles["battleOrder__ball--empty"]}`}
                    src={BALL_ICON}
                    alt={filled ? `Opponent pick ${k + 1} chosen` : "Empty slot"}
                    width={32}
                    height={32}
                    unoptimized
                  />
                )}
              </li>
            );
          })}
        </ul>
        <ul className={styles.battleOrder__team} aria-label={`${name(slot)}'s team`}>
          {members.map((p, i) => {
            const label = p.name.toUpperCase();
            const row = `${styles.battleOrder__row} ${right ? styles["battleOrder__row--right"] : ""}`;
            // Right-hand rows are mirrored in CSS (name first, icon on the outside).
            const children = (
              <>
                <PokemonIcon src={p.sprite} size={64} />
                <span>{label}</span>
              </>
            );
            return (
              <li key={p.id}>
                {isYou ? (
                  <button
                    type="button"
                    className={row}
                    disabled={!loaded || locked || yours.includes(i + 1)}
                    aria-label={`Add ${label} to your battle order`}
                    onClick={() => pick(i + 1)}
                  >
                    {children}
                  </button>
                ) : (
                  <div className={row}>{children}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <Stage className={styles.battleOrder}>
      <h1 className={styles.battleOrder__title}>CHOOSE YOUR POKéMON ORDER</h1>
      <div className={styles.battleOrder__columns}>
        {column(1)}
        <div className={styles.battleOrder__centre}>
          <p className={styles.battleOrder__format} aria-label="Battle format">
            {battleSize}V{battleSize}
          </p>
          <p className={styles.battleOrder__vs} aria-hidden="true">
            VS
          </p>
        </div>
        {column(2)}
      </div>
      <MessageBox message={message} role={notice || (failed && !locked) ? "alert" : "status"} />
    </Stage>
  );
}

/**
 * Your locked-in order once the battle has moved past the Battle order (the view
 * no longer carries it). At step 1 no one has switched yet, so the request's team
 * is still in the chosen order.
 */
function lockedOrder(view: BattleView, draft: DraftView, slot: Slot, size: number): number[] {
  const ids = draft.picks.filter((p) => p.slot === slot).map((p) => p.pokemonId);
  const order = (view.request?.team ?? []).slice(0, size).map((m) => ids.indexOf(m.pokemonId) + 1);
  return order.every((position) => position > 0) ? order : [];
}
