import type { PokemonEntry } from "./types";

export default {
  id: "weezing",
  sprite: "/sprites/pokemon-icons/weezing.png",
  isGreat: true,
  ability: "Levitate",
  set: {
    moves: ["Sludge Bomb", "Fire Blast", "Will-O-Wisp", "Pain Split"],
    item: "Black Sludge",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
