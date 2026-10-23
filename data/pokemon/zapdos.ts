import type { PokemonEntry } from "./types";

export default {
  id: "zapdos",
  sprite: "/sprites/pokemon-icons/zapdos.png",
  isUltra: true,
  ability: "Drizzle",
  set: {
    moves: ["Thunder", "Extrasensory", "Volt Switch", "Hurricane"],
    item: "Damp Rock",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
