import type { PokemonEntry } from "./types";

export default {
  id: "farfetchd",
  sprite: "/sprites/pokemon-icons/farfetch_d.png",
  ability: "Defiant",
  set: {
    moves: ["Swords Dance", "Brave Bird", "Leaf Blade", "Knock Off"],
    item: "Stick",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
