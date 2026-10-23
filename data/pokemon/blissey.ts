import type { PokemonEntry } from "./types";

export default {
  id: "blissey",
  sprite: "/sprites/pokemon-icons/blissey.png",
  isGreat: true,
  ability: "Natural Cure",
  set: {
    moves: ["Soft-Boiled", "Seismic Toss", "Toxic", "Heal Bell"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
