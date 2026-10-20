import type { PokemonEntry } from "./types";

export default {
  id: "lugia",
  sprite: "/sprites/pokemon-icons/lugia.png",
  ability: "Multiscale",
  types: ["Water", "Flying"],
  set: {
    moves: ["Aeroblast", "Surf", "Calm Mind", "Roost"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
