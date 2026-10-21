import type { PokemonEntry } from "./types";

export default {
  id: "ditto",
  sprite: "/sprites/pokemon-icons/ditto.png",
  ability: "Imposter",
  baseStats: { hp: 78, atk: 28, def: 48, spa: 28, spd: 48, spe: 108 },
  set: {
    moves: ["Transform"],
    item: "Choice Scarf",
    nature: "Relaxed",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
