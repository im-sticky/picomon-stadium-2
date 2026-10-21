import type { PokemonEntry } from "./types";

export default {
  id: "qwilfish",
  sprite: "/sprites/pokemon-icons/qwilfish.png",
  ability: "Intimidate",
  set: {
    moves: ["Swords Dance", "Waterfall", "Poison Jab", "Aqua Jet"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
