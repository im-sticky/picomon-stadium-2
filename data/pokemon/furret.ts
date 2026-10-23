import type { PokemonEntry } from "./types";

export default {
  id: "furret",
  sprite: "/sprites/pokemon-icons/furret.png",
  ability: "Frisk",
  baseStats: { hp: 85, atk: 86, def: 64, spa: 45, spd: 55, spe: 108 },
  set: {
    moves: ["Super Fang", "Baton Pass", "Curse", "Trick"],
    item: "Flame Orb",
    nature: "Jolly",
    evs: { hp: 252, def: 4, spe: 252 },
  },
} satisfies PokemonEntry;
