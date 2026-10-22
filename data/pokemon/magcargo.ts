import type { PokemonEntry } from "./types";

export default {
  id: "magcargo",
  sprite: "/sprites/pokemon-icons/magcargo.png",
  isGreat: true,
  ability: "Flame Body",
  baseStats: { hp: 60, atk: 50, def: 135, spa: 115, spd: 115, spe: 30 },
  set: {
    moves: ["Shell Smash", "Fire Blast", "Earth Power", "Ancient Power"],
    item: "White Herb",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
