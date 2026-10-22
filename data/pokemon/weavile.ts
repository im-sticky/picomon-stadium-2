import type { PokemonEntry } from "./types";

export default {
  id: "weavile",
  sprite: "/sprites/pokemon-icons/weavile.png",
  isGreat: true,
  ability: "Technician",
  set: {
    moves: ["Icicle Crash", "Knock Off", "Ice Shard", "Low Kick"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
