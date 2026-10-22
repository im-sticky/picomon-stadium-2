import type { PokemonEntry } from "./types";

export default {
  id: "jumpluff",
  sprite: "/sprites/pokemon-icons/jumpluff.png",
  isGreat: true,
  ability: "Infiltrator",
  baseStats: { hp: 95, atk: 55, def: 70, spa: 55, spd: 95, spe: 110 },
  set: {
    moves: ["Sleep Powder", "Leech Seed", "Acrobatics", "U-turn"],
    item: "Leftovers",
    nature: "Jolly",
    evs: { hp: 252, spd: 4, spe: 252 },
  },
} satisfies PokemonEntry;
