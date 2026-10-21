import type { PokemonEntry } from "./types";

export default {
  id: "seaking",
  sprite: "/sprites/pokemon-icons/seaking.png",
  ability: "Lightning Rod",
  baseStats: { hp: 80, atk: 102, def: 65, spa: 65, spd: 80, spe: 88 },
  set: {
    moves: ["Waterfall", "Megahorn", "Knock Off", "Drill Run"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
