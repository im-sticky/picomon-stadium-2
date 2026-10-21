import type { PokemonEntry } from "./types";

export default {
  id: "sandslash",
  sprite: "/sprites/pokemon-icons/sandslash.png",
  ability: "Sand Rush",
  set: {
    moves: ["Earthquake", "Knock Off", "Rapid Spin", "Stealth Rock"],
    item: "Leftovers",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
