import type { PokemonEntry } from "./types";

export default {
  id: "dodrio",
  sprite: "/sprites/pokemon-icons/dodrio.png",
  ability: "Tangled Feet",
  set: {
    moves: ["Quick Attack", "swords Dance", "Agility", "Baton Pass"],
    item: "Focus Sash",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
