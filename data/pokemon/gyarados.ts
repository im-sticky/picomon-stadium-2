import type { PokemonEntry } from "./types";

export default {
  id: "gyarados",
  sprite: "/sprites/pokemon-icons/gyarados.png",
  ability: "Intimidate",
  set: {
    moves: ["Waterfall", "Earthquake", "Dragon Dance", "Stone Edge"],
    item: "Lum Berry",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
