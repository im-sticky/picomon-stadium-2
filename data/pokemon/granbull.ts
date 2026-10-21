import type { PokemonEntry } from "./types";

export default {
  id: "granbull",
  sprite: "/sprites/pokemon-icons/granbull.png",
  ability: "Intimidate",
  set: {
    moves: ["Play Rough", "Earthquake", "Thunder Wave", "Heal Bell"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
