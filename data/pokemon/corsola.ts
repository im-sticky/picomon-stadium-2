import type { PokemonEntry } from "./types";

export default {
  id: "corsola",
  sprite: "/sprites/pokemon-icons/corsola.png",
  ability: "Regenerator",
  set: {
    moves: ["Scald", "Recover", "Toxic", "Stealth Rock"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
