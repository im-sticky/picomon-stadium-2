import type { ReactNode } from "react";
import { Frame } from "./frame";
import styles from "./crystal.module.scss";

/** Two lines of prompt or error text, Crystal style. */
export type Message = readonly [string, string];

/** `actions` (e.g. buttons) sit on the right of the text, inside the box. */
export function MessageBox({
  message,
  role = "status",
  className,
  actions,
}: {
  message: Message;
  role?: "status" | "alert";
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <Frame className={`${styles.messageBox} ${className ?? ""}`}>
      <div role={role} className={styles.messageLines}>
        <p>{message[0]}</p>
        <p>{message[1]}</p>
      </div>
      {actions}
    </Frame>
  );
}
