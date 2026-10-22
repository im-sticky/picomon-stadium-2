import type { PokemonEntry } from "./types";

export default {
  id: "electrode",
  sprite: "/sprites/pokemon-icons/electrode.png",
  isGreat: true,
  ability: "Static",
  set: {
    moves: ["Volt Switch", "Thunderbolt", "Signal Beam", "Foul Play"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
