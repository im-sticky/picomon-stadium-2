import type { PokemonEntry } from "./types";

export default {
  id: "charizard",
  sprite: "/sprites/pokemon-icons/charizard.png",
  ability: "Blaze",
  types: ["Fire", "Dragon"],
  baseStats: { hp: 78, atk: 94, def: 78, spa: 99, spd: 85, spe: 100 },
  set: {
    moves: ["Flamethrower", "Air Slash", "Focus Blast", "Roost"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
