import type { PokemonEntry } from "./types";

export default {
  id: "parasect",
  sprite: "/sprites/pokemon-icons/parasect.png",
  ability: "Dry Skin",
  baseStats: { hp: 60, atk: 115, def: 100, spa: 60, spd: 80, spe: 30 },
  set: {
    moves: ["Spore", "Seed Bomb", "X-Scissor", "Knock Off"],
    item: "Miracle Seed",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
