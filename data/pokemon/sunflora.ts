import type { PokemonEntry } from "./types";

export default {
  id: "sunflora",
  sprite: "/sprites/pokemon-icons/sunflora.png",
  ability: "Early Bird",
  types: ["Grass", "Fire"],
  baseStats: { hp: 75, atk: 55, def: 75, spa: 105, spd: 85, spe: 85 },
  set: {
    moves: ["Giga Drain", "Earth Power", "Sludge Bomb", "Synthesis"],
    item: "Life Orb",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
