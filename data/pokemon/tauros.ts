import type { PokemonEntry } from "./types";

export default {
  id: "tauros",
  sprite: "/sprites/pokemon-icons/tauros.png",
  isGreat: true,
  ability: "Intimidate",
  set: {
    moves: ["Double-Edge", "Earthquake", "Rock Slide", "Zen Headbutt"],
    item: "Choice Band",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
