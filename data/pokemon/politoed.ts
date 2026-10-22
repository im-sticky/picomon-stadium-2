import type { PokemonEntry } from "./types";

export default {
  id: "politoed",
  sprite: "/sprites/pokemon-icons/politoed.png",
  isGreat: true,
  ability: "Drizzle",
  types: ["Water", "Grass"],
  baseStats: { hp: 90, atk: 75, def: 80, spa: 90, spd: 100, spe: 80 },
  set: {
    moves: ["Scald", "Ice Beam", "Toxic", "Encore"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
