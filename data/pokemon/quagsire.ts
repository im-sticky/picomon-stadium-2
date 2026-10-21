import type { PokemonEntry } from "./types";

export default {
  id: "quagsire",
  sprite: "/sprites/pokemon-icons/quagsire.png",
  ability: "Unaware",
  baseStats: { hp: 95, atk: 95, def: 95, spa: 65, spd: 65, spe: 35 },
  set: {
    moves: ["Scald", "Earthquake", "Recover", "Toxic"],
    item: "Leftovers",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
