"use client";

import { useSyncExternalStore } from "react";
import { isTrainer, TRAINERS, type Trainer } from "@/lib/trainers";

/** Your trainer is remembered in this browser (Home and Choose a Trainer share it). */
const KEY = "picomon.trainer";
const listeners = new Set<() => void>();
/** Kept here too, so the choice holds for this visit even if storage is unavailable. */
let current: Trainer | null = null;

function read(): Trainer {
  if (current) return current;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}
  if (isTrainer(saved)) {
    current = saved;
  } else {
    // The first visit picks one at random.
    current = TRAINERS[Math.floor(Math.random() * TRAINERS.length)];
    try {
      localStorage.setItem(KEY, current);
    } catch {}
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = isTrainer(e.newValue) ? e.newValue : null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Your trainer, or null while server rendering (the browser's choice isn't known there). */
export function useTrainer(): Trainer | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function chooseTrainer(key: Trainer) {
  current = key;
  try {
    localStorage.setItem(KEY, key);
  } catch {}
  listeners.forEach((l) => l());
}
