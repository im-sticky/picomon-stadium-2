import type { PokemonEntry } from "./types";

export default {
  id: "steelix",
  sprite: "/sprites/pokemon-icons/steelix.png",
  isGreat: true,
  ability: "Sturdy",
  baseStats: { hp: 75, atk: 90, def: 200, spa: 55, spd: 65, spe: 30 },
  set: {
    moves: ["Stealth Rock", "Earthquake", "Heavy Slam", "Roar"],
    item: "Leftovers",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
