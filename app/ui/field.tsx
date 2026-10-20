import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./crystal.module.scss";

/** Section label (NAME, ROOM CODE, PLAYERS…): 16px uppercase, secondary grey. */
export function SectionLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return htmlFor ? (
    <label className={styles.label} htmlFor={htmlFor}>
      {children}
    </label>
  ) : (
    <p className={styles.label}>{children}</p>
  );
}

/** Framed text field; text shows uppercase. */
export function Field({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.field} ${className ?? ""}`} {...rest} />;
}
