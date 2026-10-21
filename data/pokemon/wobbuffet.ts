import type { PokemonEntry } from "./types";

export default {
  id: "wobbuffet",
  sprite: "/sprites/pokemon-icons/wobbuffet.png",
  ability: "Shadow Tag",
  set: {
    moves: ["Counter", "Mirror Coat", "Encore", "Destiny Bond"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
