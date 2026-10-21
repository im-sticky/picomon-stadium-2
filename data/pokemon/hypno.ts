import type { PokemonEntry } from "./types";

export default {
  id: "hypno",
  sprite: "/sprites/pokemon-icons/hypno.png",
  ability: "Insomnia",
  set: {
    moves: ["Psychic", "Focus Blast", "Thunder Wave", "Wish"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
