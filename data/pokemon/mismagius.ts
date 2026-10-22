import type { PokemonEntry } from "./types";

export default {
  id: "mismagius",
  sprite: "/sprites/pokemon-icons/mismagius.png",
  isGreat: true,
  ability: "Levitate",
  types: ["Ghost", "Fairy"],
  baseStats: { hp: 60, atk: 60, def: 60, spa: 110, spd: 110, spe: 110 },
  set: {
    moves: ["Nasty Plot", "Shadow Ball", "Dazzling Gleam", "Thunderbolt"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
