import type { PokemonEntry } from "./types";

export default {
  id: "ambipom",
  sprite: "/sprites/pokemon-icons/ambipom.png",
  ability: "Technician",
  set: {
    moves: ["Fake Out", "Double Hit", "Knock Off", "U-turn"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
