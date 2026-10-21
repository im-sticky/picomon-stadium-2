import type { PokemonEntry } from "./types";

export default {
  id: "hitmonchan",
  sprite: "/sprites/pokemon-icons/hitmonchan.png",
  ability: "Iron Fist",
  set: {
    moves: ["Drain Punch", "Ice Punch", "Thunder Punch", "Mach Punch"],
    item: "Assault Vest",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
