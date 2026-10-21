import type { PokemonEntry } from "./types";

export default {
  id: "tentacruel",
  sprite: "/sprites/pokemon-icons/tentacruel.png",
  ability: "Clear Body",
  set: {
    moves: ["Scald", "Sludge Bomb", "Rapid Spin", "Knock Off"],
    item: "Black Sludge",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
