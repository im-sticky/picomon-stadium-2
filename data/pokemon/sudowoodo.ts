import type { PokemonEntry } from "./types";

export default {
  id: "sudowoodo",
  sprite: "/sprites/pokemon-icons/sudowoodo.png",
  ability: "Rock Head",
  baseStats: { hp: 75, atk: 115, def: 130, spa: 30, spd: 80, spe: 30 },
  set: {
    moves: ["Stone Edge", "Wood Hammer", "Sucker Punch", "Earthquake"],
    item: "Choice Band",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
