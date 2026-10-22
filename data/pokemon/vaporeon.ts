import type { PokemonEntry } from "./types";

export default {
  id: "vaporeon",
  sprite: "/sprites/pokemon-icons/vaporeon.png",
  isGreat: true,
  ability: "Water Absorb",
  set: {
    moves: ["Scald", "Ice Beam", "Wish", "Protect"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
