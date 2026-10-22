import type { PokemonEntry } from "./types";

export default {
  id: "cloyster",
  sprite: "/sprites/pokemon-icons/cloyster.png",
  isGreat: true,
  ability: "Skill Link",
  set: {
    moves: ["Shell Smash", "Icicle Spear", "Rock Blast", "Ice Shard"],
    item: "Focus Sash",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
