import type { PokemonEntry } from "./types";

export default {
  id: "ninetales",
  sprite: "/sprites/pokemon-icons/ninetales.png",
  ability: "Drought",
  types: ["Fire", "Ghost"],
  set: {
    moves: ["Nasty Plot", "Fire Blast", "Hex", "Solar Beam"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
