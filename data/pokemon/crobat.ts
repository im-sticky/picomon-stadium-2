import type { PokemonEntry } from "./types";

export default {
  id: "crobat",
  sprite: "/sprites/pokemon-icons/crobat.png",
  isGreat: true,
  ability: "Infiltrator",
  set: {
    moves: ["Brave Bird", "U-turn", "Roost", "Taunt"],
    item: "Black Sludge",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
