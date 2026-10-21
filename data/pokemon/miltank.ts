import type { PokemonEntry } from "./types";

export default {
  id: "miltank",
  sprite: "/sprites/pokemon-icons/miltank.png",
  ability: "Thick Fat",
  set: {
    moves: ["Body Slam", "Earthquake", "Milk Drink", "Heal Bell"],
    item: "Leftovers",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
