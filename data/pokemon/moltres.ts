import type { PokemonEntry } from "./types";

export default {
  id: "moltres",
  sprite: "/sprites/pokemon-icons/moltres.png",
  isStrong: true,
  ability: "Drought",
  set: {
    moves: ["Fire Blast", "Hurricane", "Solar Beam", "Roost"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
