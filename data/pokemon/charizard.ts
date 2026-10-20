import type { PokemonEntry } from "./types";

export default {
  id: "charizard",
  sprite: "/sprites/pokemon-icons/charizard.png",
  ability: "Blaze",
  set: {
    moves: ["Flamethrower", "Air Slash", "Focus Blast", "Roost"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
