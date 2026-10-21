import type { PokemonEntry } from "./types";

export default {
  id: "sylveon",
  sprite: "/sprites/pokemon-icons/sylveon.png",
  ability: "Pixilate",
  set: {
    moves: ["Hyper Voice", "Psyshock", "Wish", "Protect"],
    item: "Leftovers",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
