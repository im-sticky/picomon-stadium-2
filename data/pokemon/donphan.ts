import type { PokemonEntry } from "./types";

export default {
  id: "donphan",
  sprite: "/sprites/pokemon-icons/donphan.png",
  ability: "Sturdy",
  set: {
    moves: ["Earthquake", "Ice Shard", "Knock Off", "Rapid Spin"],
    item: "Leftovers",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
