import type { PokemonEntry } from "./types";

export default {
  id: "primeape",
  sprite: "/sprites/pokemon-icons/primeape.png",
  ability: "Defiant",
  set: {
    moves: ["Close Combat", "U-turn", "Stone Edge", "Earthquake"],
    item: "Choice Scarf",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
