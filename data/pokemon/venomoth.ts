import type { PokemonEntry } from "./types";

export default {
  id: "venomoth",
  sprite: "/sprites/pokemon-icons/venomoth.png",
  ability: "Tinted Lens",
  baseStats: { hp: 70, atk: 65, def: 60, spa: 115, spd: 75, spe: 90 },
  set: {
    moves: ["Quiver Dance", "Bug Buzz", "Sludge Bomb", "Sleep Powder"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
