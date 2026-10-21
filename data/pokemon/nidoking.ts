import type { PokemonEntry } from "./types";

export default {
  id: "nidoking",
  sprite: "/sprites/pokemon-icons/nidoking.png",
  ability: "Sheer Force",
  set: {
    moves: ["Earth Power", "Sludge Wave", "Ice Beam", "Thunderbolt"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
