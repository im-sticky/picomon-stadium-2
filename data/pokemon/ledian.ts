import type { PokemonEntry } from "./types";

export default {
  id: "ledian",
  sprite: "/sprites/pokemon-icons/ledian.png",
  ability: "Iron Fist",
  types: ["Bug", "Fighting"],
  baseStats: { hp: 55, atk: 95, def: 50, spa: 35, spd: 110, spe: 85 },
  set: {
    moves: ["Drain Punch", "Mach Punch", "Ice Punch", "Thunder Punch"],
    item: "Berserk Gene",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
