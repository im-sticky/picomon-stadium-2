import type { PokemonEntry } from "./types";

export default {
  id: "hooh",
  sprite: "/sprites/pokemon-icons/ho_oh.png",
  isMaster: true,
  ability: "Regenerator",
  set: {
    moves: ["Sacred Fire", "Brave Bird", "Earthquake", "Roost"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
