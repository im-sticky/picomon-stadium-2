import type { PokemonEntry } from "./types";

export default {
  id: "dunsparce",
  sprite: "/sprites/pokemon-icons/dunsparce.png",
  ability: "Serene Grace",
  types: ["Normal", "Ground"],
  set: {
    moves: ["Coil", "Body Slam", "Earthquake", "Roost"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
