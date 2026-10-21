import type { MoveChange } from "./pokemon/types";

/** Move changes on top of stock gen6, keyed by Showdown move ID (§17.4 of the gen6 research doc). */
export const MOVE_CHANGES: Record<string, MoveChange> = {
  cut: { type: "Steel", basePower: 60, accuracy: 100 },
  fly: { accuracy: 100 },
  takedown: { accuracy: 100, pp: 15 },
  sing: { accuracy: 75 },
  supersonic: { accuracy: 65 },
  strength: { type: "Fighting" },
  firespin: { basePower: 40, accuracy: 90 },
  dig: { basePower: 90 },
  // The "???" type is display-only (§17.4), so only the PP changes here.
  metronome: { pp: 20 },
  scald: { basePower: 70 },
  crabhammer: { accuracy: 95 },
  octazooka: { basePower: 75, accuracy: 95, secondary: { chance: 30, boosts: { accuracy: -1 } } },
  painsplit: { type: "Ghost" },
  rapidspin: { pp: 20 },
  whirlpool: { basePower: 40, accuracy: 90 },
};
