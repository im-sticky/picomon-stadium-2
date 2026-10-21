import type { PokemonEntry } from "./types";

export default {
  id: "articuno",
  sprite: "/sprites/pokemon-icons/articuno.png",
  isStrong: true,
  ability: "Snow Warning",
  set: {
    moves: ["Blizzard", "Hurricane", "Freeze-Dry", "Roost"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
