import type { DraftPick, Slot } from "@/lib/types";

/** Each player always drafts this many, whatever the battle size. */
export const PICKS_PER_PLAYER = 6;
export const TOTAL_PICKS = PICKS_PER_PLAYER * 2;

const other = (slot: Slot): Slot => (slot === 1 ? 2 : 1);

/**
 * Whose pick `index` (0-based) is, or null once the draft is complete. Snake order:
 * the first drafter picks 1, then 2 each alternately, ending on 1 (A B B A A B B A A B B A).
 */
export function draftTurn(firstDrafter: Slot, index: number): Slot | null {
  if (index < 0 || index >= TOTAL_PICKS) return null;
  return Math.floor((index + 1) / 2) % 2 === 0 ? firstDrafter : other(firstDrafter);
}

/** How many picks in a row the player on turn at `index` has left, counting this one. */
export function picksLeftInTurn(firstDrafter: Slot, index: number): number {
  const turn = draftTurn(firstDrafter, index);
  let left = 0;
  while (turn !== null && draftTurn(firstDrafter, index + left) === turn) left++;
  return left;
}

export type DraftPickError =
  | "draft-complete"
  | "not-your-turn"
  | "unknown-pokemon"
  | "taken"
  | "uber-limit";

/**
 * Why `slot` can't rent `pokemonId` now, or null if it can. `isUber` looks a
 * Pokémon up in the pool and returns undefined for an id that isn't in it.
 */
export function draftPickError(
  firstDrafter: Slot,
  picks: readonly DraftPick[],
  slot: Slot,
  pokemonId: string,
  isUber: (id: string) => boolean | undefined,
): DraftPickError | null {
  const turn = draftTurn(firstDrafter, picks.length);
  if (turn === null) return "draft-complete";
  if (turn !== slot) return "not-your-turn";
  const uber = isUber(pokemonId);
  if (uber === undefined) return "unknown-pokemon";
  if (picks.some((p) => p.pokemonId === pokemonId)) return "taken";
  if (uber && picks.some((p) => p.slot === slot && isUber(p.pokemonId))) return "uber-limit";
  return null;
}
