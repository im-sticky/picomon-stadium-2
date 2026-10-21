import type { PokemonEntry } from "./types";

export default {
  id: "shuckle",
  sprite: "/sprites/pokemon-icons/shuckle.png",
  ability: "Contrary",
  set: {
    moves: ["Shell Smash", "Infestation", "Toxic", "Rest"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
