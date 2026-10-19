import type { ReactNode } from "react";
import styles from "./crystal.module.css";

/** The fixed 1200×900 screen, centred in the window. `className` sets its layout. */
export function Stage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={styles.viewport}>
      <div className={`${styles.stage} ${className ?? ""}`}>{children}</div>
    </div>
  );
}
