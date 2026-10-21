import type { PokemonEntry } from "./types";

export default {
  id: "stantler",
  sprite: "/sprites/pokemon-icons/stantler.png",
  ability: "Intimidate",
  types: ["Normal", "Psychic"],
  baseStats: { hp: 73, atk: 100, def: 62, spa: 85, spd: 65, spe: 85 },
  set: {
    moves: ["Return", "Zen Headbutt", "Megahorn", "Earthquake"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
