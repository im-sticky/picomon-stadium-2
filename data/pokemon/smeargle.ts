import type { PokemonEntry } from "./types";

export default {
  id: "smeargle",
  sprite: "/sprites/pokemon-icons/smeargle.png",
  ability: "Own Tempo",
  baseStats: { hp: 55, atk: 20, def: 35, spa: 20, spd: 45, spe: 100 },
  set: {
    moves: ["Spore", "Sticky Web", "Stealth Rock", "Destiny Bond"],
    item: "Focus Sash",
    nature: "Jolly",
    evs: { hp: 252, def: 4, spe: 252 },
  },
} satisfies PokemonEntry;
