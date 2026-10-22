import type { PokemonEntry } from "./types";

export default {
  id: "venusaur",
  sprite: "/sprites/pokemon-icons/venusaur.png",
  isGreat: true,
  ability: "Overgrow",
  set: {
    moves: ["Sludge Bomb", "Energy Ball", "Sleep Powder", "Leech Seed"],
    item: "Black Sludge",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spe: 4 },
  },
} satisfies PokemonEntry;
