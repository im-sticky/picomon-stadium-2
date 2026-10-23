import type { PokemonEntry } from "./types";

export default {
  id: "meganium",
  sprite: "/sprites/pokemon-icons/meganium.png",
  isGreat: true,
  ability: "Natural Cure",
  types: ["Grass", "Fairy"],
  set: {
    moves: ["Giga Drain", "Moonblast", "Leech Seed", "Synthesis"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
