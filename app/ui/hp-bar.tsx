import styles from "./crystal.module.scss";

/** Crystal party-screen HP bar: the "HP" label, then a track filled to value/max. */
export function HpBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`${styles.hpBar} ${className ?? ""}`} aria-hidden="true">
      <span className={styles.hpBar__label}>HP</span>
      <div className={styles.hpBar__track}>
        <div className={styles.hpBar__fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
