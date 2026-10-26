import type { PokemonEntry } from "./types";

export default {
  id: "mantine",
  sprite: "/sprites/pokemon-icons/mantine.png",
  ability: "Water Absorb",
  set: {
    moves: ["Scald", "Air Slash", "Toxic", "Rest"],
    item: "Chesto Berry",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
