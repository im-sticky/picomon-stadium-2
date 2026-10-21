import type { PokemonEntry } from "./types";

export default {
  id: "dugtrio",
  sprite: "/sprites/pokemon-icons/dugtrio.png",
  ability: "Arena Trap",
  set: {
    moves: ["Earthquake", "Stone Edge", "Sucker Punch", "Reversal"],
    item: "Focus Sash",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
