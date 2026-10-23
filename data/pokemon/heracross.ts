import type { PokemonEntry } from "./types";

export default {
  id: "heracross",
  sprite: "/sprites/pokemon-icons/heracross.png",
  isGreat: true,
  ability: "Guts",
  set: {
    moves: ["Close Combat", "Megahorn", "Facade", "Knock Off"],
    item: "Flame Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
