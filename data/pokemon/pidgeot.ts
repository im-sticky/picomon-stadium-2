import type { PokemonEntry } from "./types";

export default {
  id: "pidgeot",
  sprite: "/sprites/pokemon-icons/pidgeot.png",
  isGreat: true,
  ability: "Keen Eye",
  baseStats: { hp: 93, atk: 80, def: 75, spa: 90, spd: 70, spe: 102 },
  set: {
    moves: ["Hurricane", "Heat Wave", "U-turn", "Roost"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
