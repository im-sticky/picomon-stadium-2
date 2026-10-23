import type { PokemonEntry } from "./types";

export default {
  id: "articuno",
  sprite: "/sprites/pokemon-icons/articuno.png",
  isUltra: true,
  ability: "Snow Warning",
  set: {
    moves: ["Blizzard", "Aeroblast", "Freeze-Dry", "Roost"],
    item: "Icy Rock",
    nature: "Timid",
    evs: { hp: 252, spa: 4, spe: 252 },
  },
} satisfies PokemonEntry;
