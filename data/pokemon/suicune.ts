import type { PokemonEntry } from "./types";

export default {
  id: "suicune",
  sprite: "/sprites/pokemon-icons/suicune.png",
  isStrong: true,
  ability: "Water Absorb",
  set: {
    moves: ["Calm Mind", "Scald", "Rest", "Sleep Talk"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
