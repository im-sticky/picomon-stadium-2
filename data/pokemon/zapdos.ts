import type { PokemonEntry } from "./types";

export default {
  id: "zapdos",
  sprite: "/sprites/pokemon-icons/zapdos.png",
  isStrong: true,
  ability: "Drizzle",
  set: {
    moves: ["Thunder", "Heat Wave", "Volt Switch", "Roost"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
