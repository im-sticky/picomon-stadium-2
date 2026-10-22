import type { PokemonEntry } from "./types";

export default {
  id: "golem",
  sprite: "/sprites/pokemon-icons/golem.png",
  isGreat: true,
  ability: "Sturdy",
  set: {
    moves: ["Stealth Rock", "Earthquake", "Stone Edge", "Explosion"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
