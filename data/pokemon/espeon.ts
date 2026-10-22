import type { PokemonEntry } from "./types";

export default {
  id: "espeon",
  sprite: "/sprites/pokemon-icons/espeon.png",
  isGreat: true,
  ability: "Magic Bounce",
  set: {
    moves: ["Calm Mind", "Psyshock", "Dazzling Gleam", "Morning Sun"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
