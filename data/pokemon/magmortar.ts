import type { PokemonEntry } from "./types";

export default {
  id: "magmortar",
  sprite: "/sprites/pokemon-icons/magmortar.png",
  isGreat: true,
  ability: "Flame Body",
  types: ["Fire", "Fighting"],
  baseStats: { hp: 75, atk: 95, def: 67, spa: 125, spd: 95, spe: 93 },
  set: {
    moves: ["Fire Blast", "Focus Blast", "Thunderbolt", "Will-O-Wisp"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
