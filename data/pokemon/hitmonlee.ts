import type { PokemonEntry } from "./types";

export default {
  id: "hitmonlee",
  sprite: "/sprites/pokemon-icons/hitmonlee.png",
  ability: "Reckless",
  set: {
    moves: ["High Jump Kick", "Knock Off", "Stone Edge", "Mach Punch"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
