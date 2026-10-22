import type { PokemonEntry } from "./types";

export default {
  id: "octillery",
  sprite: "/sprites/pokemon-icons/octillery.png",
  isGreat: true,
  ability: "Sniper",
  types: ["Water", "Fire"],
  set: {
    moves: ["Octazooka", "Fire Blast", "Energy Ball", "Ice Beam"],
    item: "Life Orb",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
