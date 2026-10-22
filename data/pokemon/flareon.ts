import type { PokemonEntry } from "./types";

export default {
  id: "flareon",
  sprite: "/sprites/pokemon-icons/flareon.png",
  isGreat: true,
  ability: "Guts",
  set: {
    moves: ["Flare Blitz", "Facade", "Superpower", "Quick Attack"],
    item: "Flame Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
