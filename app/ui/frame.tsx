import type { HTMLAttributes } from "react";
import styles from "./crystal.module.scss";

type FrameProps = HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "form" | "span" };

/** Crystal double-line frame for text boxes, panels and cells. */
export function Frame({ as: Tag = "div", className, ...rest }: FrameProps) {
  return <Tag className={`${styles.frame} ${className ?? ""}`} {...rest} />;
}
