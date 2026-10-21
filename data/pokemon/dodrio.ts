import type { PokemonEntry } from "./types";

export default {
  id: "dodrio",
  sprite: "/sprites/pokemon-icons/dodrio.png",
  ability: "Early Bird",
  set: {
    moves: ["Brave Bird", "Return", "Knock Off", "Quick Attack"],
    item: "Choice Band",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
