import type { PokemonEntry } from "./types";

export default {
  id: "kingdra",
  sprite: "/sprites/pokemon-icons/kingdra.png",
  ability: "Sniper",
  set: {
    moves: ["Dragon Dance", "Waterfall", "Outrage", "Iron Head"],
    item: "Lum Berry",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
