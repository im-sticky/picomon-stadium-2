import type { PokemonEntry } from "./types";

export default {
  id: "muk",
  sprite: "/sprites/pokemon-icons/muk.png",
  isGreat: true,
  ability: "Poison Touch",
  set: {
    moves: ["Gunk Shot", "Fire Punch", "Ice Punch", "Shadow Sneak"],
    item: "Assault Vest",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
