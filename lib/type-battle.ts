import { TYPE_CHOICES, type Slot, type TypeChoice } from "@/lib/types";

/** Each type beats the one it maps to: Grass > Water > Fire > Grass. */
export const BEATS: Record<TypeChoice, TypeChoice> = { grass: "water", water: "fire", fire: "grass" };

export function isTypeChoice(value: unknown): value is TypeChoice {
  return typeof value === "string" && (TYPE_CHOICES as readonly string[]).includes(value);
}

/** The winning slot for the host's and guest's picks, or null for a draw. */
export function typeBattleWinner(host: TypeChoice, guest: TypeChoice): Slot | null {
  if (host === guest) return null;
  return BEATS[host] === guest ? 1 : 2;
}
