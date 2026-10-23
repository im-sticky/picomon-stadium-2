import type { PokemonEntry } from "./types";

export default {
  id: "moltres",
  sprite: "/sprites/pokemon-icons/moltres.png",
  isUltra: true,
  ability: "Drought",
  set: {
    moves: ["Flamethrower", "Hurricane", "Solar Beam", "U-turn"],
    item: "Heat Rock",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
