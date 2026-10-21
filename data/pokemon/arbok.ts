import type { PokemonEntry } from "./types";

export default {
  id: "arbok",
  sprite: "/sprites/pokemon-icons/arbok.png",
  ability: "Intimidate",
  set: {
    moves: ["Coil", "Gunk Shot", "Earthquake", "Sucker Punch"],
    item: "Black Sludge",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
