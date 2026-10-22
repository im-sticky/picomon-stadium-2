import type { PokemonEntry } from "./types";

export default {
  id: "scizor",
  sprite: "/sprites/pokemon-icons/scizor.png",
  isGreat: true,
  ability: "Technician",
  set: {
    moves: ["Bullet Punch", "U-turn", "Superpower", "Pursuit"],
    item: "Choice Band",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
