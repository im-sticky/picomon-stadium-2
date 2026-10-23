import type { PokemonEntry } from "./types";

export default {
  id: "ambipom",
  sprite: "/sprites/pokemon-icons/ambipom.png",
  isGreat: true,
  ability: "Technician",
  set: {
    moves: ["Fake Out", "Double Hit", "Fling", "Acrobatics"],
    item: "Sharp Beak",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
