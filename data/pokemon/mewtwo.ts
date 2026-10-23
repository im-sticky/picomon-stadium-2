import type { PokemonEntry } from "./types";

export default {
  id: "mewtwo",
  sprite: "/sprites/pokemon-icons/mewtwo.png",
  isMaster: true,
  ability: "Insomnia",
  set: {
    moves: ["Psystrike", "Aura Sphere", "Ice Beam", "Power Gem"],
    item: "Lum Berry",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
