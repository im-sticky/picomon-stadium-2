import type { PokemonEntry } from "./types";

export default {
  id: "vileplume",
  sprite: "/sprites/pokemon-icons/vileplume.png",
  isGreat: true,
  ability: "Effect Spore",
  baseStats: { hp: 75, atk: 80, def: 85, spa: 120, spd: 100, spe: 50 },
  set: {
    moves: ["Giga Drain", "Sludge Bomb", "Sleep Powder", "Moonlight"],
    item: "Black Sludge",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
