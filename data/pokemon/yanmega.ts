import type { PokemonEntry } from "./types";

export default {
  id: "yanmega",
  sprite: "/sprites/pokemon-icons/yanmega.png",
  ability: "Speed Boost",
  types: ["Bug", "Dragon"],
  set: {
    moves: ["Protect", "Bug Buzz", "Air Slash", "Giga Drain"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
