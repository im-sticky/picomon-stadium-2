"use client";

import { useEffect, useState } from "react";
import { formatClock, secondsLeft, WARN_SECONDS, type Clock } from "@/lib/battle-feed";
import styles from "./battle.module.scss";

/** How often the countdown redraws. */
const TICK_MS = 250;

/**
 * The step's countdown, `m:ss` in 32px, red from 0:15. It counts down to the
 * server's deadline through the clock offset; no local timer decides anything.
 */
export function Countdown({ clock, className }: { clock: Clock; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [clock]);
  const left = secondsLeft(clock, now);
  const text = formatClock(left);
  return (
    <p
      role="timer"
      aria-label={`Time left ${text}`}
      className={`${styles.countdown} ${left <= WARN_SECONDS ? styles["countdown--warn"] : ""} ${className ?? ""}`}
    >
      {text}
    </p>
  );
}
