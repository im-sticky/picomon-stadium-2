import type { ButtonHTMLAttributes } from "react";
import styles from "./crystal.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean };

/** 240×108 Crystal button with a ▶ cursor on hover/focus. Wider via `style`/`className`. */
export function Button({ primary, className, children, type = "button", ...rest }: ButtonProps) {
  const cls = [styles.button, primary && styles.primary, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      <svg
        className={styles.cursor}
        width="24"
        height="24"
        viewBox="0 0 8 8"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <path d="M1 0h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1z" />
      </svg>
      {children}
    </button>
  );
}
