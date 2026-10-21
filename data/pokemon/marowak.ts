import type { PokemonEntry } from "./types";

export default {
  id: "marowak",
  sprite: "/sprites/pokemon-icons/marowak.png",
  ability: "Rock Head",
  baseStats: { hp: 60, atk: 80, def: 110, spa: 50, spd: 80, spe: 70 },
  set: {
    moves: ["Bonemerang", "Stone Edge", "Knock Off", "Swords Dance"],
    item: "Thick Club",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
