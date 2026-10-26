import type { PokemonEntry } from "./types";

export default {
  id: "persian",
  sprite: "/sprites/pokemon-icons/persian.png",
  ability: "Technician",
  set: {
    moves: ["Fake Out", "Return", "U-turn", "Knock Off"],
    item: "Muscle Band",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
