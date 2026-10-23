import type { PokemonEntry } from "./types";

export default {
  id: "yanmega",
  sprite: "/sprites/pokemon-icons/yanmega.png",
  isGreat: true,
  ability: "Speed Boost",
  types: ["Bug", "Dragon"],
  set: {
    moves: ["Protect", "Bug Buzz", "Dragonbreath", "Baton Pass"],
    item: "Lum Berry",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
