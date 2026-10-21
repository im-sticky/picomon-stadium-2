import type { PokemonEntry } from "./types";

export default {
  id: "skarmory",
  sprite: "/sprites/pokemon-icons/skarmory.png",
  ability: "Sturdy",
  baseStats: { hp: 85, atk: 80, def: 140, spa: 40, spd: 70, spe: 70 },
  set: {
    moves: ["Brave Bird", "Roost", "Whirlwind", "Stealth Rock"],
    item: "Rocky Helmet",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
