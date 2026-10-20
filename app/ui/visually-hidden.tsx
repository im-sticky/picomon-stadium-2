import type { ReactNode } from "react";
import styles from "./crystal.module.scss";

/** Text for screen readers only. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.srOnly}>{children}</span>;
}
