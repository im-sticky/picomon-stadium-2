import type { PokemonEntry } from "./types";

export default {
  id: "houndoom",
  sprite: "/sprites/pokemon-icons/houndoom.png",
  ability: "Flash Fire",
  set: {
    moves: ["Nasty Plot", "Fire Blast", "Dark Pulse", "Sludge Bomb"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
