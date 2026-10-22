import type { PokemonEntry } from "./types";

export default {
  id: "rapidash",
  sprite: "/sprites/pokemon-icons/rapidash.png",
  isGreat: true,
  ability: "Flash Fire",
  types: ["Fire", "Fairy"],
  set: {
    moves: ["Flare Blitz", "Wild Charge", "Megahorn", "Morning Sun"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
