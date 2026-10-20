"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import styles from "./crystal.module.scss";

const BUTTON = 36;
const MIN_THUMB = 36;

/** ▲ in light pixels; the down button flips it. */
function Arrow({ down }: { down?: boolean }) {
  return (
    <svg
      width="21"
      height="12"
      viewBox="0 0 7 4"
      shapeRendering="crispEdges"
      style={down ? { transform: "scaleY(-1)" } : undefined}
    >
      <path d="M3 0h1v1h1v1h1v1h1v1H0V3h1V2h1V1h1z" />
    </svg>
  );
}

/**
 * A vertically scrolling box with the classic pixel scrollbar on its right (the
 * browser's own bar is hidden). The box scrolls natively and stays keyboard
 * focusable, so the bar is hidden from screen readers. ▲/▼ scroll by `step`,
 * clicking the track pages, and the thumb can be dragged.
 */
export function PixelScroll({
  label,
  height,
  step,
  className,
  children,
}: {
  label: string;
  height: number;
  step: number;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ top: 0, scroll: 1, client: 1 });
  const stopDrag = useRef<(() => void) | null>(null);

  const measure = useCallback(() => {
    const el = box.current;
    if (el) setM({ top: el.scrollTop, scroll: el.scrollHeight, client: el.clientHeight });
  }, []);

  useEffect(() => {
    const el = box.current;
    measure();
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => () => stopDrag.current?.(), []);

  const track = height - BUTTON * 2;
  const max = Math.max(1, m.scroll - m.client);
  const fits = m.scroll <= m.client;
  const thumb = fits ? track : Math.max(MIN_THUMB, Math.round((track * m.client) / m.scroll));
  const thumbTop = fits ? 0 : Math.round((m.top / max) * (track - thumb));

  const scrollBy = (dy: number) => box.current?.scrollBy({ top: dy, behavior: "smooth" });

  function onTrackDown(e: PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - rect.top) * track) / rect.height;
    scrollBy(y < thumbTop ? -m.client : m.client);
  }

  function onThumbDown(e: PointerEvent<HTMLDivElement>) {
    const el = box.current;
    if (!el || fits) return;
    e.preventDefault();
    // Screen pixels to layout pixels, in case the page is zoomed.
    const scale = e.currentTarget.parentElement!.getBoundingClientRect().height / track;
    const startY = e.clientY;
    const start = el.scrollTop;
    const ratio = max / (track - thumb);
    const move = (ev: globalThis.PointerEvent) => {
      el.scrollTop = start + ((ev.clientY - startY) / scale) * ratio;
    };
    const up = () => stopDrag.current?.();
    stopDrag.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      stopDrag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className={`${styles.pixelScroll} ${className ?? ""}`} style={{ height }}>
      <div ref={box} className={styles.pixelScroll__box} tabIndex={0} aria-label={label} onScroll={measure}>
        {children}
      </div>
      <div className={styles.pixelScroll__bar} aria-hidden="true">
        <button type="button" className={styles.pixelScroll__button} tabIndex={-1} onClick={() => scrollBy(-step)}>
          <Arrow />
        </button>
        <div className={styles.pixelScroll__track} onPointerDown={onTrackDown}>
          <div className={styles.pixelScroll__thumb} style={{ top: thumbTop, height: thumb }} onPointerDown={onThumbDown} />
        </div>
        <button type="button" className={styles.pixelScroll__button} tabIndex={-1} onClick={() => scrollBy(step)}>
          <Arrow down />
        </button>
      </div>
    </div>
  );
}
