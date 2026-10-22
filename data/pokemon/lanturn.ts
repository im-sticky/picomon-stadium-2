import type { PokemonEntry } from "./types";

export default {
  id: "lanturn",
  sprite: "/sprites/pokemon-icons/lanturn.png",
  isGreat: true,
  ability: "Volt Absorb",
  baseStats: { hp: 125, atk: 58, def: 58, spa: 86, spd: 86, spe: 67 },
  set: {
    moves: ["Scald", "Volt Switch", "Ice Beam", "Heal Bell"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
