import type { PokemonEntry } from "./types";

export default {
  id: "ursaring",
  sprite: "/sprites/pokemon-icons/ursaring.png",
  isGreat: true,
  ability: "Guts",
  set: {
    moves: ["Facade", "Close Combat", "Crunch", "Protect"],
    item: "Flame Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
