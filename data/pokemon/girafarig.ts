import type { PokemonEntry } from "./types";

export default {
  id: "girafarig",
  sprite: "/sprites/pokemon-icons/girafarig.png",
  ability: "Sap Sipper",
  types: ["Psychic", "Dark"],
  baseStats: { hp: 70, atk: 80, def: 65, spa: 100, spd: 65, spe: 95 },
  set: {
    moves: ["Nasty Plot", "Psychic", "Shadow Ball", "Thunderbolt"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
