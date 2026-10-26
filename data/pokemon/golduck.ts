import type { PokemonEntry } from "./types";

export default {
  id: "golduck",
  sprite: "/sprites/pokemon-icons/golduck.png",
  isGreat: true,
  ability: "Cloud Nine",
  types: ["Water", "Psychic"],
  set: {
    moves: ["Calm Mind", "Scald", "Psyshock", "Ice Beam"],
    item: "Shell Bell",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
