import type { PokemonEntry } from "./types";

export default {
  id: "sunflora",
  sprite: "/sprites/pokemon-icons/sunflora.png",
  isGreat: true,
  ability: "Solar Power",
  types: ["Grass", "Fire"],
  baseStats: { hp: 75, atk: 55, def: 75, spa: 105, spd: 85, spe: 85 },
  set: {
    moves: ["Flamethrower", "Earth Power", "Sludge Bomb", "Solar Beam"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spd: 252 },
  },
} satisfies PokemonEntry;
