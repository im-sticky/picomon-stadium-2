import type { ButtonHTMLAttributes } from "react";
import styles from "./battle.module.scss";

/** The ▶ cursor, shown on hover and focus. */
function Cursor() {
  return (
    <svg className={styles.menuItem__cursor} width="24" height="24" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M1 0h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1z" />
    </svg>
  );
}

/**
 * A battle menu item (FIGHT, POKéMON, BACK, a move): 24px text with the ▶ cursor
 * on hover/focus, not a framed button. `on` keeps the cursor showing.
 */
export function MenuItem({ on, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" role="menuitem" className={`${styles.menuItem} ${on ? styles["menuItem--on"] : ""} ${className ?? ""}`} {...rest}>
      <Cursor />
      {children}
    </button>
  );
}
