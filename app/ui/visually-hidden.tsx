import type { ReactNode } from "react";
import styles from "./crystal.module.css";

/** Text for screen readers only. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.srOnly}>{children}</span>;
}
