import type { PokemonEntry } from "./types";

export default {
  id: "gliscor",
  sprite: "/sprites/pokemon-icons/gliscor.png",
  ability: "Poison Heal",
  set: {
    moves: ["Swords Dance", "Earthquake", "Knock Off", "Roost"],
    item: "Toxic Orb",
    nature: "Impish",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
