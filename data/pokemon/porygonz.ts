import type { PokemonEntry } from "./types";

export default {
  id: "porygonz",
  sprite: "/sprites/pokemon-icons/porygon_z.png",
  isGreat: true,
  ability: "Adaptability",
  set: {
    moves: ["Nasty Plot", "Tri Attack", "Shadow Ball", "Ice Beam"],
    item: "Silk Scarf",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
