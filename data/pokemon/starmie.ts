import type { PokemonEntry } from "./types";

export default {
  id: "starmie",
  sprite: "/sprites/pokemon-icons/starmie.png",
  isGreat: true,
  ability: "Natural Cure",
  set: {
    moves: ["Scald", "Psyshock", "Rapid Spin", "Recover"],
    item: "Leftovers",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
