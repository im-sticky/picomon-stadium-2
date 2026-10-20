"use client";

import { useState } from "react";
import Image from "next/image";
import type { PoolMove, PoolPokemon, StatKey } from "@/lib/draft-pool";
import { Button } from "@/app/ui/button";
import { Frame } from "@/app/ui/frame";
import { HeldItem } from "@/app/ui/held-item";
import { HpBar } from "@/app/ui/hp-bar";
import { PokemonIcon } from "@/app/ui/pokemon-icon";
import { Stage } from "@/app/ui/stage";
import { TypeBadge } from "@/app/ui/type-badge";
import styles from "./draft.module.scss";

const LEVEL = 50;
const STATS: { key: StatKey; base: string; calc: string }[] = [
  { key: "hp", base: "HP", calc: "HP" },
  { key: "atk", base: "ATTACK", calc: "Attack" },
  { key: "def", base: "DEFENSE", calc: "Defense" },
  { key: "spa", base: "SP.ATK", calc: "Sp.Atk" },
  { key: "spd", base: "SP.DEF", calc: "Sp.Def" },
  { key: "spe", base: "SPEED", calc: "Speed" },
];

/** Level 50 stat with 31 IVs, 0 EVs and a neutral nature (the same formula in gens 3-6). */
export function levelStat(base: number, isHp: boolean): number {
  const core = Math.floor(((2 * base + 31) * LEVEL) / 100);
  return isHp ? core + LEVEL + 10 : core + 5;
}

function barColour(value: number): string {
  if (value <= 50) return "#e04030";
  if (value <= 80) return "#f08830";
  if (value <= 110) return "#f0c830";
  if (value <= 135) return "#40a848";
  return "#48b8e8";
}

const powerAccuracy = (m: PoolMove) =>
  `${m.power === null ? "---" : `${m.power}P`}/${m.accuracy === null ? "---" : `${m.accuracy}%`}`;

/**
 * One Pokémon's details. Opened from the grid it can be rented (RENT is enabled
 * only when the pick is allowed); opened from a team strip it is view only.
 */
export function DetailScreen({
  pokemon,
  title,
  viewOnly,
  canRent,
  onRent,
  onBack,
}: {
  pokemon: PoolPokemon;
  title: string;
  viewOnly: boolean;
  canRent: boolean;
  onRent: () => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<"calc" | "base">("calc");
  const move = pokemon.moves[selected];
  const { baseStats } = pokemon;
  const hp = levelStat(baseStats.hp, true);
  const total = STATS.reduce((sum, s) => sum + baseStats[s.key], 0);

  return (
    <Stage className={styles.detail}>
      <h1 className={styles.title}>{title}</h1>
      <Frame className={styles.detailMain}>
        <div className={styles.top}>
          <PokemonIcon src={pokemon.sprite} size={128} alt={pokemon.name} />
          <div className={styles.nameBlock}>
            <h2 className={styles.detailName}>{pokemon.name.toUpperCase()}</h2>
            <div className={styles.badges}>
              {pokemon.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <HeldItem item={pokemon.item} />
          </div>
          <section aria-label="Ability" className={styles.abilityBox}>
            <p className={styles.label}>ABILITY</p>
            <p className={styles.abilityName}>{pokemon.ability.name}</p>
            <p className={styles.abilityText}>{pokemon.ability.description}</p>
          </section>
        </div>

        <div className={styles.columns}>
          <section aria-label="Moves" className={styles.moves}>
            <p className={`${styles.label} ${styles.movesLabel}`}>MOVES</p>
            {pokemon.moves.map((m, i) => (
              <button
                key={m.name}
                type="button"
                className={`${styles.move} ${i === selected ? styles.on : ""}`}
                aria-pressed={i === selected}
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onClick={() => setSelected(i)}
              >
                <span className={styles.moveName}>{m.name.toUpperCase()}</span>
                <span className={styles.pp}>
                  PP {m.pp}/{m.pp}
                </span>
              </button>
            ))}
          </section>

          <section aria-label="Stats" className={styles.stats}>
            <div className={styles.statsHead}>
              <p className={styles.label}>STATS</p>
              <div role="group" aria-label="Stat view" className={styles.toggle}>
                <button
                  type="button"
                  className={`${styles.seg} ${view === "calc" ? styles.segOn : ""}`}
                  aria-pressed={view === "calc"}
                  onClick={() => setView("calc")}
                >
                  LV.{LEVEL}
                </button>
                <button
                  type="button"
                  className={`${styles.seg} ${view === "base" ? styles.segOn : ""}`}
                  aria-pressed={view === "base"}
                  onClick={() => setView("base")}
                >
                  BASE
                </button>
              </div>
            </div>
            {view === "calc" ? (
              <>
                <div className={styles.statRow}>
                  <span>HP</span>
                  <span>
                    {hp}/{hp}
                  </span>
                </div>
                <div className={styles.hpRow}>
                  <HpBar value={hp} max={hp} className={styles.hpBar} />
                </div>
                {STATS.slice(1).map((s) => (
                  <div key={s.key} className={styles.statRow}>
                    <span>{s.calc}</span>
                    <span>{levelStat(baseStats[s.key], false)}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                {STATS.map((s) => (
                  <div key={s.key} className={styles.baseRow}>
                    <span>{s.base}</span>
                    <span className={styles.baseValue}>{baseStats[s.key]}</span>
                    <div className={styles.bar}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.round((baseStats[s.key] / 160) * 100))}%`,
                          background: barColour(baseStats[s.key]),
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className={styles.baseRow}>
                  <span className={styles.total}>TOTAL</span>
                  <span className={styles.baseValue}>{total}</span>
                </div>
              </>
            )}
          </section>
        </div>
      </Frame>

      <Frame className={styles.moveBox} aria-live="polite" aria-label={move?.name}>
        {move && (
          <>
            <div className={styles.catRow}>
              <Image
                className={styles.pixel}
                src={`/sprites/misc/icon-${move.category.toLowerCase()}.png`}
                alt={move.category}
                width={64}
                height={32}
                unoptimized
              />
              <TypeBadge type={move.type} className={styles.catBadge} />
              <p className={styles.powAcc}>{powerAccuracy(move)}</p>
            </div>
            <p className={styles.line}>{move.effect}</p>
          </>
        )}
      </Frame>

      <div className={styles.buttons}>
        {!viewOnly && (
          <Button primary disabled={!canRent} onClick={onRent}>
            RENT
          </Button>
        )}
        <Button onClick={onBack}>BACK</Button>
      </div>
    </Stage>
  );
}
