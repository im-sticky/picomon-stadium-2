import type { PokemonEntry } from "./types";

export default {
  id: "furret",
  sprite: "/sprites/pokemon-icons/furret.png",
  ability: "Frisk",
  baseStats: { hp: 85, atk: 86, def: 64, spa: 45, spd: 55, spe: 108 },
  set: {
    moves: ["Double-Edge", "U-turn", "Knock Off", "Trick"],
    item: "Choice Scarf",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
