import { Frame } from "./frame";
import styles from "./crystal.module.css";

/** Two lines of prompt or error text, Crystal style. */
export type Message = readonly [string, string];

export function MessageBox({
  message,
  role = "status",
  className,
}: {
  message: Message;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <Frame role={role} className={`${styles.messageBox} ${className ?? ""}`}>
      <p>{message[0]}</p>
      <p>{message[1]}</p>
    </Frame>
  );
}
