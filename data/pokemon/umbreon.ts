import type { PokemonEntry } from "./types";

export default {
  id: "umbreon",
  sprite: "/sprites/pokemon-icons/umbreon.png",
  ability: "Synchronize",
  set: {
    moves: ["Foul Play", "Wish", "Protect", "Toxic"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
