"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { pokemonSprites } from "@/data/pokemon-sprites";
import {
  isMoveUsable,
  clockFromEvent,
  clockFromView,
  newerClock,
  planEvent,
  stepsFromView,
  timeoutDelay,
  TIMEOUT_EVERY_MS,
  type Clock,
  type StepLines,
} from "@/lib/battle-feed";
import {
  applyBeat,
  initialScene,
  replay,
  stepBeats,
  toId,
  type Battler,
  type Beat,
  type Message,
  type Scene,
} from "@/lib/battle-script";
import type { BattleChoice, BattleResult, BattleView, MoveOption, TeamMember } from "@/lib/battle-types";
import type { PoolMove, PoolPokemon } from "@/lib/draft-pool";
import { isTrainer, trainerSprite } from "@/lib/trainers";
import type { RoomState, Slot } from "@/lib/types";
import { Button } from "@/app/ui/button";
import { Frame } from "@/app/ui/frame";
import { HpBar, StatusSlot } from "@/app/ui/hp-bar";
import { MessageBox } from "@/app/ui/message-box";
import { PokemonBack } from "@/app/ui/pokemon-back";
import { PokemonFront } from "@/app/ui/pokemon-front";
import { Stage } from "@/app/ui/stage";
import { StatusTag } from "@/app/ui/status-tag";
import { TypeBadge } from "@/app/ui/type-badge";
import { MenuItem } from "./battle-menu";
import { Countdown } from "./countdown";
import { DetailScreen } from "./detail-screen";
import { PartyScreen } from "./party-screen";
import type { RoomAction, SubscribeBattle } from "./room-view";
import styles from "./battle.module.scss";

const BALL_ICON = "/sprites/misc/icon-pokeballball.png";
/** After a `battle-step`, wait this long for your own view (exact HP) before playing the public lines. */
const VIEW_WAIT_MS = 1500;
/** Backoff before each retry of a failed view fetch; the last one repeats while the screen is up. */
const FETCH_RETRY_MS = [500, 1500, 4000, 8000];
/** A step that's ahead of the next one waits this long for the missing one before a fetch (spec §9.4). */
const GAP_HOLD_MS = 500;
/** While waiting on the opponent (or behind), check the server this often in case a publish was lost. */
const IDLE_RESYNC_MS = 15_000;
const FAILED: Message = ["Something went wrong.", "Try again."];
/** Struggle isn't in any set, so the pool doesn't have it. */
const STRUGGLE: PoolMove = { name: "Struggle", type: "Normal", category: "Physical", power: 50, accuracy: null, pp: 1, effect: "" };

type Mode = "battle" | "fight" | "party" | "detail";

const post = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The end of the battle, in the message box: two short lines, to fit beside REMATCH and QUIT. */
function endMessage(result: BattleResult, name: (slot: Slot) => string): Message {
  if (result.winner === null) return ["It's a draw!", ""];
  if (result.reason === "forfeit") return [name(result.winner === 1 ? 2 : 1), "forfeited."];
  return [`${name(result.winner)} won`, "the battle!"];
}

/**
 * The battle (boards 4a–4e, 4i–4k): each player sees it from their own side. The
 * server's protocol lines drive every message, HP bar and ability box; the
 * server's deadline drives the countdown. Your Pokémon (4f) and Detail (4g/4h)
 * open from here.
 */
export function BattleScreen({
  state,
  pool,
  notice,
  subscribeBattle,
  onAction,
  onRoomChanged,
  onClosed,
}: {
  state: RoomState;
  pool: readonly PoolPokemon[];
  notice?: Message;
  subscribeBattle: SubscribeBattle;
  /** For REMATCH: its result (a new game) updates the room state. */
  onAction: RoomAction;
  /** The battle is gone but the room isn't (a rematch started): fetch the room state. */
  onRoomChanged: () => void;
  /** The room is closed (QUIT, or the end screen's time ran out): go to Home. */
  onClosed: () => void;
}) {
  const { code, players, you, battleSize } = state;
  const opponent: Slot = you.slot === 1 ? 2 : 1;
  const name = (slot: Slot) => (players.find((p) => p.slot === slot)?.name ?? "").toUpperCase();
  // Room state updates give `players` a new identity; the playback reads names through
  // a ref so its callbacks (and the subscription effect) stay stable.
  const names = { 1: name(1), 2: name(2) };
  const namesKey = `${you.slot}|${names[1]}|${names[2]}`;
  const script = useRef({ you: you.slot, names });
  const closedRef = useRef(onClosed);
  const roomChangedRef = useRef(onRoomChanged);
  useEffect(() => {
    const [slot, n1, n2] = namesKey.split("|");
    script.current = { you: Number(slot) as Slot, names: { 1: n1, 2: n2 } };
  }, [namesKey]);
  useEffect(() => {
    closedRef.current = onClosed;
    roomChangedRef.current = onRoomChanged;
  }, [onClosed, onRoomChanged]);
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const itemNames = useMemo(() => new Map(pool.map((p) => [toId(p.item), p.item])), [pool]);
  const movesById = useMemo(() => {
    const map = new Map<string, PoolMove>([["struggle", STRUGGLE]]);
    for (const p of pool) for (const m of p.moves) map.set(toId(m.name), m);
    return map;
  }, [pool]);
  const opponentTrainer = players.find((p) => p.slot === opponent)?.trainer ?? null;

  const [scene, setScene] = useState<Scene>(initialScene);
  const [view, setView] = useState<BattleView | null>(null);
  const [played, setPlayed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState<Clock | null>(null);
  const [result, setResult] = useState<{ step: number; result: BattleResult } | null>(null);
  const [mode, setMode] = useState<Mode>("battle");
  const [detail, setDetail] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  /** The step a choice failed on: the notice shows only while that step is current. */
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [quitting, setQuitting] = useState(false);
  /** After the battle: the slot that asked for a rematch. */
  const [rematchBy, setRematchBy] = useState<Slot | null>(null);
  const [rematching, setRematching] = useState(false);

  const viewRef = useRef<BattleView | null>(null);
  const playedRef = useRef(0);
  const queue = useRef<Beat[]>([]);
  /** The scene once everything queued has played: who is on the field when the next step starts. */
  const queuedScene = useRef<Scene>(initialScene());
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);
  const fetching = useRef<number | null>(null);
  const refetchFrom = useRef<number | null>(null);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncRef = useRef<(from?: number) => Promise<void>>(async () => {});
  const lastTrigger = useRef(0);
  const live = useRef(true);

  /** Shows the next beat, then waits its hold; stops when the queue is empty. */
  const kick = useCallback(() => {
    const next = () => {
      if (beatTimer.current || !live.current) return;
      const beat = queue.current.shift();
      if (!beat) {
        setPlaying(false);
        return;
      }
      setPlaying(true);
      setMode("battle");
      setScene((s) => applyBeat(s, beat));
      beatTimer.current = setTimeout(() => {
        beatTimer.current = null;
        next();
      }, beat.hold);
    };
    next();
  }, []);

  /** Queues steps' lines for playback (or applies them at once, rebuilding after a refresh). */
  const enqueue = useCallback(
    (steps: StepLines[], animate: boolean) => {
      if (steps.length === 0) return;
      const team = viewRef.current?.request?.team ?? [];
      for (const s of steps) {
        if (s.step <= playedRef.current) continue;
        const beats = stepBeats(s.lines, {
          ...script.current,
          exact: s.exact,
          maxHpOf: (mon) => team.find((m) => m.details.split(",")[0] === mon)?.maxhp,
          field: queuedScene.current.active,
        });
        queuedScene.current = beats.reduce(applyBeat, queuedScene.current);
        if (animate) queue.current.push(...beats);
        else setScene((sc) => replay(sc, beats));
        playedRef.current = s.step;
      }
      setPlayed(playedRef.current);
      kick();
    },
    [kick],
  );

  /** Takes a view of yours: queues its new steps and keeps its request, deadline and result. */
  const applyView = useCallback(
    (incoming: BattleView) => {
      let next = incoming;
      const current = viewRef.current;
      // An older step's view (a slow response) has nothing new.
      if (current && next.step < current.step) return;
      // A late read of the same step can't take back a choice you've made.
      if (current && next.step === current.step && current.chosen && !next.chosen) next = { ...next, chosen: true };
      viewRef.current = next;
      setView(next);
      setClock((c) => newerClock(c, clockFromView(next, Date.now())));
      if (next.result) setResult({ step: next.step, result: next.result });
      if (next.rematch !== null) setRematchBy(next.rematch);
      // A view that starts after a step you haven't played (e.g. a timeout's, from
      // its step + 1) leaves a gap: keep its request and clock, and fetch the rest.
      if (loaded.current && next.log.from > playedRef.current + 1) {
        void resyncRef.current(playedRef.current + 1);
        return;
      }
      // On the first load only the intro (step 1) plays; a later step is rebuilt at once.
      const animate = loaded.current || next.step <= 1;
      loaded.current = true;
      enqueue(stepsFromView(playedRef.current, next), animate);
    },
    [enqueue],
  );

  /** Fetches your view from step `from` on. One fetch at a time; a later ask runs after it. */
  const resync = useCallback(
    async (from = playedRef.current + 1) => {
      if (fetching.current !== null) {
        refetchFrom.current = Math.min(refetchFrom.current ?? from, from);
        return;
      }
      fetching.current = from;
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await fetch(`/api/rooms/${code}/battle?from=${from}`);
            if (res.status === 404) return closedRef.current();
            // No battle any more (a rematch started): the room state says what's next.
            if (res.status === 409) return roomChangedRef.current();
            if (res.ok) {
              if (live.current) applyView((await res.json()) as BattleView);
              return;
            }
          } catch {
            // Retried below.
          }
          // Keep trying while the screen is up: the next step can't be played without it.
          if (!live.current) return;
          await sleep(FETCH_RETRY_MS[Math.min(attempt, FETCH_RETRY_MS.length - 1)]);
        }
      } finally {
        fetching.current = null;
        const again = refetchFrom.current;
        refetchFrom.current = null;
        if (again !== null && live.current) void resync(Math.min(again, playedRef.current + 1));
      }
    },
    [code, applyView],
  );
  useEffect(() => {
    resyncRef.current = resync;
  }, [resync]);

  // Subscribe to battle steps; resync on mount, reconnects and tab switches. Next keeps
  // earlier routes alive in <Activity>, which runs this cleanup when hidden, so the
  // playback timer is cleared here and picks up again when shown.
  useEffect(() => {
    live.current = true;
    void resync(viewRef.current ? playedRef.current + 1 : 1);
    kick();
    const unsubscribe = subscribeBattle((event) => {
      if (!event) return void resync();
      if (event.kind === "rematch-requested") return setRematchBy(event.slot);
      if (event.kind !== "battle-step") return;
      setClock((c) => newerClock(c, clockFromEvent(event, Date.now())));
      if (event.result) setResult({ step: event.step, result: event.result });
      const plan = planEvent(playedRef.current, event);
      if (plan.kind === "duplicate") return;
      if (plan.kind === "gap") {
        // Hold it briefly for the missing step's own event, then fetch (spec §9.4).
        if (gapTimer.current) return;
        gapTimer.current = setTimeout(() => {
          gapTimer.current = null;
          if (playedRef.current < event.step) void resync(playedRef.current + 1);
        }, GAP_HOLD_MS);
        return;
      }
      if (plan.lines === null) return void resync(event.step);
      // Your own view has your exact HP: fetch it, and play the public lines only if it's slow.
      const lines = plan.lines;
      void resync(event.step);
      if (waitTimer.current) clearTimeout(waitTimer.current);
      waitTimer.current = setTimeout(() => {
        waitTimer.current = null;
        if (playedRef.current === event.step - 1) enqueue([{ step: event.step, lines, exact: false }], true);
      }, VIEW_WAIT_MS);
    });
    return () => {
      live.current = false;
      unsubscribe();
      if (beatTimer.current) clearTimeout(beatTimer.current);
      beatTimer.current = null;
      if (waitTimer.current) clearTimeout(waitTimer.current);
      waitTimer.current = null;
      if (gapTimer.current) clearTimeout(gapTimer.current);
      gapTimer.current = null;
    };
  }, [subscribeBattle, resync, kick, enqueue]);

  // When the countdown has run out (plus the server's grace), ask the server to apply
  // the timeout, at most every 2 s. Its view re-arms this from the server's clock.
  useEffect(() => {
    if (!clock || clock.deadline === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const fire = () => {
      lastTrigger.current = Date.now();
      post(`/api/rooms/${code}/battle/timeout`, { step: clock.step })
        .then((res) => {
          // The end screen's time ran out and the room is closed.
          if (res.status === 404) closedRef.current();
          return res.ok ? (res.json() as Promise<{ view: BattleView }>) : null;
        })
        .then((body) => body && live.current && applyView(body.view))
        .catch(() => {});
      timer = setTimeout(fire, TIMEOUT_EVERY_MS);
    };
    timer = setTimeout(fire, timeoutDelay(clock, Date.now(), lastTrigger.current) ?? 0);
    return () => clearTimeout(timer);
  }, [clock, code, applyView]);

  /** Sends a move or switch for the current step. A lost response or a 503 is resent once. */
  async function choose(choice: BattleChoice) {
    const current = viewRef.current;
    if (!current || sending) return;
    setSending(true);
    setFailedStep(null);
    setMode("battle");
    setHover(null);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try {
          res = await post(`/api/rooms/${code}/battle/choice`, { step: current.step, choice });
        } catch {
          if (attempt === 0) {
            await sleep(300 + Math.random() * 300);
            continue;
          }
          break;
        }
        if (res.status === 503 && attempt === 0) {
          await sleep(300 + Math.random() * 300);
          continue;
        }
        const body = (await res.json().catch(() => null)) as { view?: BattleView } | null;
        // Success, already chosen (a resend), a stale step, not asked, ended or rejected:
        // each carries the server's view, which says what happens next.
        if (body?.view) {
          applyView(body.view);
          if (res.status === 422) setFailedStep(body.view.step);
          return;
        }
        if (res.status === 404) return onClosed();
        break;
      }
      setFailedStep(current.step);
      await resync(playedRef.current + 1);
    } finally {
      setSending(false);
    }
  }

  async function quit() {
    if (quitting) return;
    setQuitting(true);
    try {
      const res = await post(`/api/rooms/${code}/close`, {});
      // Already closed (a resend) is a 404: Home either way.
      if (res.ok || res.status === 404) return onClosed();
    } catch {
      // Left for another press.
    }
    setQuitting(false);
  }

  async function rematch() {
    if (rematching || rematchBy === you.slot) return;
    setRematching(true);
    // A new game comes back as a room event, which replaces this screen.
    if (await onAction("rematch")) setRematchBy((by) => by ?? you.slot);
    setRematching(false);
  }

  // What the screen can show now: the playback, or the server's latest request.
  const caughtUp = !playing && view !== null && view.step === played;
  const ended = result !== null && played >= result.step && !playing;
  const request = caughtUp && !ended ? view.request : null;
  const waiting = sending || (request !== null && (view!.chosen || request.kind === "wait"));
  const canAct = request !== null && !waiting && (request.kind === "move" || request.kind === "switch");
  const team: TeamMember[] = request?.team ?? view?.request?.team ?? [];
  const canSwitch = request?.kind === "switch" || (request?.kind === "move" && request.canSwitch);
  const forced = canAct && request?.kind === "switch";
  const failed = failedStep !== null && view?.step === failedStep;
  // Waiting on the opponent, or behind the server with nothing playing: check in now and then.
  // On the end screen, check in too, in case a rematch request's publish was lost.
  const idle = !playing && (ended || waiting || !caughtUp);
  useEffect(() => {
    if (!idle) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void resyncRef.current();
    }, IDLE_RESYNC_MS);
    return () => clearInterval(id);
  }, [idle]);

  // Your info block: exact HP from your lines, or from the request once caught up.
  const activeMember = caughtUp ? team.find((m) => m.active) : undefined;
  let me: Battler | null = scene.active.me;
  if (me && activeMember && toId(activeMember.details.split(",")[0]) === me.pokemonId) {
    me = { ...me, hp: activeMember.fainted ? 0 : activeMember.hp, maxhp: activeMember.maxhp, status: activeMember.status as Battler["status"] };
  }
  const opp = scene.active.opp;

  const title = `${name(you.slot)}'S POKéMON`;

  if (canAct && mode === "detail" && team[detail]) {
    const member = team[detail];
    const pokemon = byId.get(member.pokemonId);
    if (pokemon) {
      const step = (d: number) => setDetail((i) => (i + d + team.length) % team.length);
      return (
        <DetailScreen
          key={member.pokemonId}
          pokemon={pokemon}
          title={title}
          viewOnly
          canRent={false}
          onRent={() => {}}
          onBack={() => setMode("party")}
          battle={{
            member,
            item: member.item ? (itemNames.get(member.item) ?? member.item) : "None",
            clock,
            canSwitch: !!canSwitch && !member.fainted && !member.active,
            onSwitch: () => void choose({ kind: "switch", slot: member.position as 2 }),
            onPrev: () => step(-1),
            onNext: () => step(1),
          }}
        />
      );
    }
  }

  if (canAct && (mode === "party" || mode === "detail" || forced)) {
    return (
      <PartyScreen
        title={title}
        team={team}
        pool={byId}
        clock={clock}
        forced={forced}
        onOpen={(i) => {
          setDetail(i);
          setMode("detail");
        }}
        onBack={() => setMode("battle")}
      />
    );
  }

  const moves = request?.kind === "move" ? request.moves : [];
  const hovered = hover !== null ? moves[hover] : undefined;

  let bottom;
  if (canAct && request?.kind === "move" && mode === "fight") {
    bottom = (
      <>
        <Frame className={styles.battle__moves}>
          <div role="menu" aria-label="Moves" className={styles.battle__moveList}>
            {moves.map((m, i) => (
              <MenuItem
                key={m.id}
                on={hover === i}
                disabled={!isMoveUsable(m)}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                onClick={() => void choose({ kind: "move", move: m.move as 1 })}
              >
                {m.name.toUpperCase()}
              </MenuItem>
            ))}
          </div>
          {hovered && <MoveInfo move={hovered} info={movesById.get(hovered.id)} />}
        </Frame>
        <Frame className={styles.battle__options} role="menu">
          <MenuItem onClick={() => setMode("battle")}>BACK</MenuItem>
        </Frame>
      </>
    );
  } else if (canAct && request?.kind === "move") {
    bottom = (
      <>
        <MessageBox
          className={styles.battle__message}
          message={failed ? FAILED : ["What will", `${me ? me.name.toUpperCase() : ""} do?`]}
          actions={clock && <Countdown clock={clock} />}
        />
        <Frame className={styles.battle__options} role="menu">
          <MenuItem
            onClick={() => {
              setHover(null);
              setMode("fight");
            }}
          >
            FIGHT
          </MenuItem>
          <MenuItem onClick={() => setMode("party")}>POKéMON</MenuItem>
        </Frame>
      </>
    );
  } else {
    let message: Message = scene.message;
    if (!playing) {
      if (ended && rematchBy === you.slot) message = ["Waiting for", `${name(opponent)}...`];
      else if (ended && rematchBy !== null) message = ["Rematch", "requested!"];
      else if (ended) message = endMessage(result.result, name);
      else if (waiting) message = [`Waiting for ${name(opponent)}...`, ""];
      else if (failed) message = FAILED;
    }
    if (notice && !playing) message = notice;
    // Once you've asked for a rematch, both choices wait on the opponent.
    const choosing = quitting || rematching || rematchBy === you.slot;
    bottom = (
      <MessageBox
        className={`${styles.battle__message} ${ended ? styles["battle__message--end"] : ""}`}
        message={message}
        role={notice && !playing ? "alert" : "status"}
        actions={
          ended ? (
            <>
              {clock && <Countdown clock={clock} />}
              <div role="group" aria-label="After the battle" className={styles.battle__endButtons}>
                <Button primary className={styles.battle__endButton} disabled={choosing} onClick={() => void rematch()}>
                  REMATCH
                </Button>
                <Button className={styles.battle__endButton} disabled={choosing} onClick={() => void quit()}>
                  QUIT
                </Button>
              </div>
            </>
          ) : undefined
        }
      />
    );
  }

  // The opponent's row says how many they have left: fainted balls first, darkened.
  // Mid-battle it slides in and out in their info box's place; at the intro it's just there.
  const balls = (side: "me" | "opp") => {
    const slot = side === "me" ? you.slot : opponent;
    const out = side === "opp" ? Math.min(scene.oppFainted, battleSize) : 0;
    const slide = side === "opp" && !scene.intro && scene.oppBalls ? styles[`battle__balls--${scene.oppBalls}`] : "";
    return (
      <div
        className={`${styles.battle__balls} ${styles[`battle__balls--${side}`]} ${slide}`}
        {...(side === "me"
          ? { "aria-label": "Your team" }
          : { role: "img", "aria-label": `${name(opponent)}'s team: ${battleSize - out} of ${battleSize} left` })}
      >
        {Array.from({ length: battleSize }, (_, k) => (
          <Image
            key={k}
            className={`${styles.battle__ball} ${slot === 2 ? styles["battle__ball--p2"] : ""} ${k < out ? styles["battle__ball--out"] : ""}`}
            src={BALL_ICON}
            alt=""
            width={32}
            height={32}
            unoptimized
          />
        ))}
      </div>
    );
  };

  // A transformed Pokémon shows the sprite it copied, a little lighter.
  const spriteOf = (mon: Battler | null) =>
    mon && !mon.fainted ? (pokemonSprites[mon.transformedInto ?? ""] ?? pokemonSprites[mon.pokemonId]) : undefined;
  const spriteClass = (mon: Battler | null) =>
    mon?.transformedInto ? `${styles.battle__sprite} ${styles["battle__sprite--transformed"]}` : styles.battle__sprite;
  const oppSprite = spriteOf(opp);
  const mySprite = spriteOf(me);
  const oppTypes = opp ? (byId.get(opp.pokemonId)?.types ?? []) : [];
  const myTypes = me ? (byId.get(me.pokemonId)?.types ?? []) : [];

  return (
    <Stage className={styles.battle}>
      {scene.intro && (
        <>
          {isTrainer(opponentTrainer) && (
            <div className={styles.battle__trainer}>
              <Image className={styles.battle__trainerImage} src={trainerSprite(opponentTrainer)} alt={name(opponent)} width={336} height={336} unoptimized />
            </div>
          )}
          {balls("opp")}
          {balls("me")}
        </>
      )}
      {!scene.intro && scene.oppBalls && balls("opp")}

      {/* A fainted Pokémon's info goes with its sprite, and steps aside while the ball row is up. */}
      {opp && !opp.fainted && !scene.oppBalls && (
        <section className={`${styles.battle__info} ${styles["battle__info--opp"]}`} aria-label={opp.name.toUpperCase()}>
          <p className={styles.battle__name}>{opp.name.toUpperCase()}</p>
          <div className={styles.battle__level}>
            <StatusSlot className={styles.battle__status}>
              <StatusTag status={opp.status} />
            </StatusSlot>
            <span>L50</span>
          </div>
          {/* The opponent's HP is only ever the bar: no numbers, here or for screen readers. */}
          <div className={styles.battle__hpRow}>
            <HpBar value={opp.hp} max={opp.maxhp} animate className={styles.battle__hpBar} />
          </div>
          <div className={styles.battle__types} aria-label="Types">
            {oppTypes.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </section>
      )}
      {oppSprite && (
        <div className={`${styles.battle__spriteBox} ${styles["battle__spriteBox--opp"]}`}>
          <PokemonFront key={`opp-${scene.entrances.opp}`} sprite={oppSprite} alt={opp!.name.toUpperCase()} className={spriteClass(opp)} />
        </div>
      )}

      {mySprite && (
        <div className={`${styles.battle__spriteBox} ${styles["battle__spriteBox--me"]}`}>
          <PokemonBack key={`me-${scene.entrances.me}`} sprite={mySprite} alt={me!.name.toUpperCase()} className={spriteClass(me)} />
        </div>
      )}
      {me && !me.fainted && (
        <section className={`${styles.battle__info} ${styles["battle__info--me"]}`} aria-label={me.name.toUpperCase()}>
          <p className={styles.battle__name}>{me.name.toUpperCase()}</p>
          <div className={styles.battle__level}>
            <StatusSlot className={styles.battle__status}>
              <StatusTag status={me.status} />
            </StatusSlot>
            <span>L50</span>
          </div>
          <div className={styles.battle__hpRow}>
            <HpBar value={me.hp} max={me.maxhp} animate className={styles.battle__hpBar} />
          </div>
          <p className={styles.battle__hpNumbers}>
            {me.hp}/{me.maxhp}
          </p>
          <div className={`${styles.battle__types} ${styles["battle__types--me"]}`} aria-label="Types">
            {myTypes.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </section>
      )}

      {scene.ability && (
        <div role="status" className={`${styles.battle__ability} ${styles[`battle__ability--${scene.ability.side}`]}`}>
          <p>{scene.ability.name}&apos;s</p>
          <p className={styles.battle__abilityName}>{scene.ability.ability}</p>
        </div>
      )}

      <div className={styles.battle__bottom}>{bottom}</div>
    </Stage>
  );
}

/** The hovered move's category, type, power/accuracy and PP left. Recharge and the like have no entry and no PP. */
function MoveInfo({ move, info }: { move: MoveOption; info: PoolMove | undefined }) {
  const power = info?.power ? `${info.power}P` : "---";
  const accuracy = info?.accuracy ? `${info.accuracy}%` : "---";
  return (
    <div className={styles.battle__moveInfo} aria-live="polite">
      <div className={styles.battle__moveType}>
        {info && (
          <>
            <Image
              className={styles.battle__category}
              src={`/sprites/misc/icon-${info.category.toLowerCase()}.png`}
              alt={info.category}
              width={64}
              height={32}
              unoptimized
            />
            <TypeBadge type={info.type} />
          </>
        )}
      </div>
      <p className={styles.battle__moveLine}>
        {power}/{accuracy}
      </p>
      <p className={styles.battle__moveLine}>
        {move.pp === null ? "PP --" : `PP ${move.pp}/${move.maxpp}`}
      </p>
    </div>
  );
}
