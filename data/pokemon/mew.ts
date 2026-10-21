import type { PokemonEntry } from "./types";

export default {
  id: "mew",
  sprite: "/sprites/pokemon-icons/mew.png",
  isStrong: true,
  ability: "Magic Guard",
  set: {
    moves: ["Nasty Plot", "Psychic", "Aura Sphere", "Fire Blast"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
