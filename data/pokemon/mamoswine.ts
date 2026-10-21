import type { PokemonEntry } from "./types";

export default {
  id: "mamoswine",
  sprite: "/sprites/pokemon-icons/mamoswine.png",
  ability: "Thick Fat",
  set: {
    moves: ["Earthquake", "Icicle Crash", "Ice Shard", "Knock Off"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
