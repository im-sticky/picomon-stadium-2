import type { PokemonEntry } from "./types";

export default {
  id: "beedrill",
  sprite: "/sprites/pokemon-icons/beedrill.png",
  ability: "Adaptability",
  baseStats: { hp: 65, atk: 100, def: 40, spa: 45, spd: 90, spe: 115 },
  set: {
    moves: ["U-turn", "Poison Jab", "Drill Run", "Outrage"],
    item: "Weakness Policy",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
