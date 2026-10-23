import type { PokemonEntry } from "./types";

export default {
  id: "electivire",
  sprite: "/sprites/pokemon-icons/electivire.png",
  isGreat: true,
  ability: "Motor Drive",
  types: ["Electric", "Fighting"],
  baseStats: { hp: 75, atk: 123, def: 67, spa: 95, spd: 85, spe: 105 },
  set: {
    moves: ["Wild Charge", "Brick Break", "Ice Punch", "Earthquake"],
    item: "Expert Belt",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
