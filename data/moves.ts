import type { MoveChange } from "./pokemon/types";

/** Move changes on top of stock gen6, keyed by Showdown move ID (§17.4 of the gen6 research doc). */
export const MOVE_CHANGES: Record<string, MoveChange> = {
  cut: { type: "Steel", basePower: 60, accuracy: 100 },
  octazooka: { basePower: 75, accuracy: 95, secondary: { chance: 30, boosts: { accuracy: -1 } } },
};
