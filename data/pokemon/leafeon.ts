import type { PokemonEntry } from "./types";

export default {
  id: "leafeon",
  sprite: "/sprites/pokemon-icons/leafeon.png",
  isGreat: true,
  ability: "Natural Cure",
  set: {
    moves: ["Swords Dance", "Leaf Blade", "Knock Off", "X-Scissor"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
