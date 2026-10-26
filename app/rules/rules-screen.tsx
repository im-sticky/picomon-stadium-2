import type { ReactNode } from "react";
import Image from "next/image";
import { Frame } from "../ui/frame";
import { Stage } from "../ui/stage";
import styles from "./rules.module.scss";

/** A 32px ball icon inline in a rule, before the ball's name. */
function Ball({ ball }: { ball: "ultraball" | "masterball" | "pokeballball" }) {
  return (
    <Image className={styles.rules__ball} src={`/sprites/misc/icon-${ball}.png`} alt="" width={32} height={32} unoptimized />
  );
}

/**
 * Draft rules (board 0e): the rules for every draft, then each draft type's own.
 * `back` is the BACK button, which depends on where the rules were opened from.
 */
export function RulesScreen({ back }: { back: ReactNode }) {
  return (
    <main>
      <Stage className={styles.rules}>
        <h1 className={styles.rules__title}>DRAFT RULES</h1>
        <Frame as="section" aria-label="Draft rules" className={styles.rules__panel}>
          <ul className={styles.rules__list}>
            <li className={styles.rules__rule}>Each POKéMON can only be picked once.</li>
            <li className={styles.rules__rule}>
              The first player picks 1 POKéMON. Then each player picks 2 until both have 6.
            </li>
            <li className={styles.rules__rule}>Only one of each held item per team.</li>
          </ul>
          <h2 className={styles.rules__heading}>Standard Draft</h2>
          <ul className={styles.rules__list}>
            <li className={styles.rules__rule}>
              Only 1<Ball ball="ultraball" />
              Ultra Ball POKéMON per team.
            </li>
            <li className={styles.rules__rule}>
              Only 1<Ball ball="masterball" />
              Master Ball POKéMON per team.
            </li>
          </ul>
          <h2 className={styles.rules__heading}>Unlimited Draft</h2>
          <ul className={styles.rules__list}>
            <li className={styles.rules__rule}>No limits to rank of POKéMON.</li>
          </ul>
          <h2 className={styles.rules__heading}>Poké Ball Draft</h2>
          <ul className={styles.rules__list}>
            <li className={styles.rules__rule}>
              Only<Ball ball="pokeballball" />
              Poké Ball POKéMON allowed.
            </li>
          </ul>
        </Frame>
        <div className={styles.rules__buttons}>{back}</div>
      </Stage>
    </main>
  );
}
