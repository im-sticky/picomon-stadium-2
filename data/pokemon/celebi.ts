import type { PokemonEntry } from "./types";

export default {
  id: "celebi",
  sprite: "/sprites/pokemon-icons/celebi.png",
  isUltra: true,
  ability: "Natural Cure",
  types: ["Grass", "Fairy"],
  set: {
    moves: ["Nasty Plot", "Giga Drain", "Dazzling Gleam", "Recover"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
