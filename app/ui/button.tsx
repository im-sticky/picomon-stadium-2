import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import Link from "next/link";
import styles from "./crystal.module.scss";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean };

const buttonClass = (primary?: boolean, className?: string) =>
  [styles.button, primary && styles["button--primary"], className].filter(Boolean).join(" ");

/** The ▶ cursor shown on hover/focus. */
function Cursor() {
  return (
    <svg
      className={styles.button__cursor}
      width="24"
      height="24"
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d="M1 0h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1z" />
    </svg>
  );
}

/** Crystal button (at least 240×108) with a ▶ cursor on hover/focus. Grows to fit its label. */
export function Button({ primary, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(primary, className)} {...rest}>
      <Cursor />
      {children}
    </button>
  );
}

/** A `Button` that navigates: a Next `<Link>` with the same look. */
export function ButtonLink({
  primary,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { primary?: boolean; children: ReactNode }) {
  return (
    <Link className={buttonClass(primary, className)} {...rest}>
      <Cursor />
      {children}
    </Link>
  );
}
