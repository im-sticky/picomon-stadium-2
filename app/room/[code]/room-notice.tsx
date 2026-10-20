import { MessageBox, type Message } from "@/app/ui/message-box";
import { Stage } from "@/app/ui/stage";
import styles from "./room.module.scss";

export const LOADING: Message = ["Loading...", ""];
export const LIVE_FAILED: Message = ["Live updates unavailable.", "Refresh the page."];

/** A screen with just a message box, for loading and errors before the room state arrives. */
export function RoomNotice({ message, role }: { message: Message; role?: "status" | "alert" }) {
  return (
    <Stage className={styles.notice}>
      <MessageBox message={message} role={role} />
    </Stage>
  );
}
