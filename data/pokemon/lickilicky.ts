import type { PokemonEntry } from "./types";

export default {
  id: "lickilicky",
  sprite: "/sprites/pokemon-icons/lickilicky.png",
  isGreat: true,
  ability: "Own Tempo",
  set: {
    moves: ["Explosion", "Return", "Earthquake", "Power Whip"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
