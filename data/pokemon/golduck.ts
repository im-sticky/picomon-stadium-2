import type { PokemonEntry } from "./types";

export default {
  id: "golduck",
  sprite: "/sprites/pokemon-icons/golduck.png",
  ability: "Cloud Nine",
  types: ["Water", "Psychic"],
  set: {
    moves: ["Calm Mind", "Scald", "Psyshock", "Ice Beam"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
