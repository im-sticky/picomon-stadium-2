import type { ReactNode } from "react";
import styles from "./crystal.module.scss";

/** The fill's colour band: green, yellow below 51%, red below 15%. */
export function hpBand(value: number, max: number): "ok" | "low" | "critical" {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return pct < 15 ? "critical" : pct < 51 ? "low" : "ok";
}

/**
 * Crystal party-screen HP bar: the "HP" label, then a track filled to value/max.
 * `animate` slides the fill to each new value (the battle screen).
 */
export function HpBar({
  value,
  max,
  className,
  animate,
}: {
  value: number;
  max: number;
  className?: string;
  animate?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const band = hpBand(value, max);
  return (
    <div className={`${styles.hpBar} ${animate ? styles["hpBar--animate"] : ""} ${className ?? ""}`} aria-hidden="true">
      <span className={styles.hpBar__label}>HP</span>
      <div className={styles.hpBar__track}>
        <div
          className={`${styles.hpBar__fill} ${band === "ok" ? "" : styles[`hpBar__fill--${band}`]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** The status slot: reserved space for a status sprite. Empty outside battle. */
export function StatusSlot({ className, children }: { className?: string; children?: ReactNode }) {
  return <span className={`${styles.statusSlot} ${className ?? ""}`}>{children}</span>;
}
