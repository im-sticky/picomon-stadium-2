import type { PokemonEntry } from "./types";

export default {
  id: "togekiss",
  sprite: "/sprites/pokemon-icons/togekiss.png",
  isGreat: true,
  ability: "Serene Grace",
  set: {
    moves: ["Air Slash", "Dazzling Gleam", "Roost", "Thunder Wave"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
