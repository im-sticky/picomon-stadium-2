import type { PokemonEntry } from "./types";

export default {
  id: "tangrowth",
  sprite: "/sprites/pokemon-icons/tangrowth.png",
  ability: "Regenerator",
  set: {
    moves: ["Giga Drain", "Knock Off", "Sleep Powder", "Leech Seed"],
    item: "Rocky Helmet",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
