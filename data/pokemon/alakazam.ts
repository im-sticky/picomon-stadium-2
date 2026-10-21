import type { PokemonEntry } from "./types";

export default {
  id: "alakazam",
  sprite: "/sprites/pokemon-icons/alakazam.png",
  ability: "Magic Guard",
  set: {
    moves: ["Calm Mind", "Psychic", "Focus Blast", "Shadow Ball"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
