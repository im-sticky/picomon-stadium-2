import type { PokemonEntry } from "./types";

export default {
  id: "pinsir",
  sprite: "/sprites/pokemon-icons/pinsir.png",
  isGreat: true,
  ability: "Moxie",
  set: {
    moves: ["Swords Dance", "X-Scissor", "Close Combat", "Stone Edge"],
    item: "Expert Belt",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
