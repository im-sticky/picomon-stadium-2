import type { DraftPick, DraftType, Slot } from "@/lib/types";

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
  | "not-in-pool"
  | "taken"
  | TeamLimitError;

/** The team limits: one Master Ball and one Ultra Ball Pokémon (Standard only), each item once. */
export type TeamLimitError = "master-limit" | "ultra-limit" | "item-limit";

/** A Pokémon's ball tier, and the held item no two on a team may share. */
export type DraftLimits = { isMaster: boolean; isUltra: boolean; isGreat: boolean; item: string };

/**
 * Whether a Pokémon can be drafted at all in this draft type. A Poké Ball draft only
 * has Poké Ball tier Pokémon: none of Great, Ultra or Master. The others use the whole pool.
 */
export function inDraftPool(draftType: DraftType, pokemon: Omit<DraftLimits, "item">): boolean {
  if (draftType !== "pokeball") return true;
  return !pokemon.isGreat && !pokemon.isUltra && !pokemon.isMaster;
}

/**
 * Which team limit stops a player whose team is `team` from adding `pokemon`, or null.
 * Only Standard limits Ultra and Master Ball Pokémon; every type allows each item once.
 */
export function teamLimitError(
  draftType: DraftType,
  team: readonly (DraftLimits | undefined)[],
  pokemon: DraftLimits,
): TeamLimitError | null {
  if (draftType === "standard") {
    if (pokemon.isMaster && team.some((p) => p?.isMaster)) return "master-limit";
    if (pokemon.isUltra && team.some((p) => p?.isUltra)) return "ultra-limit";
  }
  if (team.some((p) => p?.item === pokemon.item)) return "item-limit";
  return null;
}

/**
 * Why `slot` can't rent `pokemonId` now under `draftType`'s rules, or null if it can.
 * `limits` looks a Pokémon up in the pool and returns undefined for an id that isn't in it.
 */
export function draftPickError(
  draftType: DraftType,
  firstDrafter: Slot,
  picks: readonly DraftPick[],
  slot: Slot,
  pokemonId: string,
  limits: (id: string) => DraftLimits | undefined,
): DraftPickError | null {
  const turn = draftTurn(firstDrafter, picks.length);
  if (turn === null) return "draft-complete";
  if (turn !== slot) return "not-your-turn";
  const pokemon = limits(pokemonId);
  if (pokemon === undefined) return "unknown-pokemon";
  if (!inDraftPool(draftType, pokemon)) return "not-in-pool";
  if (picks.some((p) => p.pokemonId === pokemonId)) return "taken";
  const mine = picks.filter((p) => p.slot === slot).map((p) => limits(p.pokemonId));
  return teamLimitError(draftType, mine, pokemon);
}
