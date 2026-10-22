import type { PokemonEntry } from "./types";

export default {
  id: "dewgong",
  sprite: "/sprites/pokemon-icons/dewgong.png",
  isGreat: true,
  ability: "Thick Fat",
  baseStats: { hp: 90, atk: 70, def: 80, spa: 80, spd: 95, spe: 70 },
  set: {
    moves: ["Surf", "Ice Beam", "Toxic", "Protect"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
