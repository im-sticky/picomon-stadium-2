import type { PokemonEntry } from "./types";

export default {
  id: "clefable",
  sprite: "/sprites/pokemon-icons/clefable.png",
  isGreat: true,
  ability: "Magic Guard",
  set: {
    moves: ["Moonblast", "Calm Mind", "Soft-Boiled", "Flamethrower"],
    item: "Life Orb",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
