"use client";

import { useEffect, useState } from "react";
import { GAME_FRAME_MS, type PokemonSprite } from "@/data/pokemon-sprites";
import styles from "./crystal.module.scss";

/**
 * A Pokémon's animated front battle sprite, bottom-centred in a 112px box. Plays
 * `anim` once, then rests on frame 0, or loops the sprite's idle animation if `idle`
 * is set; restarts when the sprite changes. Reduced motion shows the resting frame only.
 */
export function PokemonFront({
  sprite,
  idle = false,
  alt = "",
  className,
}: {
  sprite: PokemonSprite;
  idle?: boolean;
  alt?: string;
  className?: string;
}) {
  return (
    <span className={className ? `${styles.pokemonSprite} ${className}` : styles.pokemonSprite}>
      <FrontStrip key={sprite.front} sprite={sprite} idle={idle} alt={alt} />
    </span>
  );
}

/** One frame of the front strip at a time. Keyed by sprite, so a new one starts over. */
function FrontStrip({ sprite, idle, alt }: { sprite: PokemonSprite; idle: boolean; alt: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Schedule each step against the start time, so long loops don't drift.
    let due = performance.now();
    let timer: number;
    const play = (steps: PokemonSprite["anim"], i: number) => {
      if (i === steps.length) {
        if (idle && sprite.idle.length) play(sprite.idle, 0);
        else setFrame(0);
        return;
      }
      const [step, duration] = steps[i];
      setFrame(step);
      due += duration * GAME_FRAME_MS;
      timer = window.setTimeout(() => play(steps, i + 1), due - performance.now());
    };
    timer = window.setTimeout(() => play(sprite.anim, 0), 0);
    return () => window.clearTimeout(timer);
  }, [sprite, idle]);

  return (
    <span
      className={styles.pokemonSprite__front}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      style={{
        width: sprite.size,
        height: sprite.size,
        backgroundImage: `url(${sprite.front})`,
        backgroundPosition: `0 ${-frame * sprite.size}px`,
      }}
    />
  );
}
