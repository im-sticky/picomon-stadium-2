import type { PokemonEntry } from "./types";

export default {
  id: "gengar",
  sprite: "/sprites/pokemon-icons/gengar.png",
  isGreat: true,
  ability: "Levitate",
  set: {
    moves: ["Shadow Ball", "Sludge Bomb", "Focus Blast", "Thunderbolt"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
