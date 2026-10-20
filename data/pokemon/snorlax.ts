import type { PokemonEntry } from "./types";

export default {
  id: "snorlax",
  sprite: "/sprites/pokemon-icons/snorlax.png",
  ability: "Thick Fat",
  set: {
    moves: ["Body Slam", "Crunch", "Rest", "Sleep Talk"],
    item: "Leftovers",
    nature: "Careful",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
