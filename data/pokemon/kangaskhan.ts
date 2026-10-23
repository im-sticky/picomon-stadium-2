import type { PokemonEntry } from "./types";

export default {
  id: "kangaskhan",
  sprite: "/sprites/pokemon-icons/kangaskhan.png",
  isGreat: true,
  ability: "Scrappy",
  set: {
    moves: ["Fake Out", "Double-Edge", "Sucker Punch", "Earthquake"],
    item: "Silk Scarf",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
