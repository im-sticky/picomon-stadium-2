import type { PokemonEntry } from "./types";

export default {
  id: "forretress",
  sprite: "/sprites/pokemon-icons/forretress.png",
  ability: "Sturdy",
  set: {
    moves: ["Stealth Rock", "Rapid Spin", "Volt Switch", "Gyro Ball"],
    item: "Leftovers",
    nature: "Relaxed",
    evs: { hp: 252, def: 252, spd: 4 },
    ivs: { spe: 0 },
  },
} satisfies PokemonEntry;
