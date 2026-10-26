import type { PokemonEntry } from "./types";

export default {
  id: "butterfree",
  sprite: "/sprites/pokemon-icons/butterfree.png",
  ability: "Tinted Lens",
  types: ["Bug", "Psychic"],
  baseStats: { hp: 60, atk: 45, def: 50, spa: 110, spd: 110, spe: 80 },
  set: {
    moves: ["Quiver Dance", "Bug Buzz", "Psychic", "Sleep Powder"],
    item: "Silver Powder",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
