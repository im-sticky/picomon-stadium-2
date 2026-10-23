import type { PokemonEntry } from "./types";

export default {
  id: "tyranitar",
  sprite: "/sprites/pokemon-icons/tyranitar.png",
  isUltra: true,
  ability: "Sand Stream",
  set: {
    moves: ["Dragon Dance", "Stone Edge", "Crunch", "Earthquake"],
    item: "Smooth Rock",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
