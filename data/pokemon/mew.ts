import type { PokemonEntry } from "./types";

export default {
  id: "mew",
  sprite: "/sprites/pokemon-icons/mew.png",
  isUltra: true,
  ability: "Magic Guard",
  set: {
    moves: ["Zen Headbutt", "Bulk Up", "Toxic", "Recover"],
    item: "Leftovers",
    nature: "Jolly",
    evs: { hp: 252, def: 252, spe: 4 },
  },
} satisfies PokemonEntry;
