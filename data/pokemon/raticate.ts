import type { PokemonEntry } from "./types";

export default {
  id: "raticate",
  sprite: "/sprites/pokemon-icons/raticate.png",
  ability: "Guts",
  baseStats: { hp: 65, atk: 91, def: 60, spa: 50, spd: 70, spe: 107 },
  set: {
    moves: ["Facade", "Sucker Punch", "U-turn", "Super Fang"],
    item: "Flame Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
