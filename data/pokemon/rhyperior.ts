import type { PokemonEntry } from "./types";

export default {
  id: "rhyperior",
  sprite: "/sprites/pokemon-icons/rhyperior.png",
  ability: "Solid Rock",
  types: ["Steel", "Rock"],
  baseStats: { hp: 120, atk: 140, def: 130, spa: 55, spd: 60, spe: 40 },
  set: {
    moves: ["Rock Polish", "Stone Edge", "Earthquake", "Iron Tail"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
