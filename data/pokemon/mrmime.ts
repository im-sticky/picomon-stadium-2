import type { PokemonEntry } from "./types";

export default {
  id: "mrmime",
  sprite: "/sprites/pokemon-icons/mr__mime.png",
  isGreat: true,
  ability: "Filter",
  baseStats: { hp: 50, atk: 45, def: 65, spa: 100, spd: 125, spe: 100 },
  set: {
    moves: ["Nasty Plot", "Psychic", "Dazzling Gleam", "Focus Blast"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
