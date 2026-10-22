import type { PokemonEntry } from "./types";

export default {
  id: "feraligatr",
  sprite: "/sprites/pokemon-icons/feraligatr.png",
  isGreat: true,
  ability: "Sheer Force",
  types: ["Water", "Dark"],
  set: {
    moves: ["Dragon Dance", "Waterfall", "Crunch", "Ice Punch"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
