import type { PokemonEntry } from "./types";

export default {
  id: "typhlosion",
  sprite: "/sprites/pokemon-icons/typhlosion.png",
  isGreat: true,
  ability: "Flash Fire",
  types: ["Fire", "Ground"],
  set: {
    moves: ["Eruption", "Fire Blast", "Focus Blast", "Extrasensory"],
    item: "Choice Specs",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
