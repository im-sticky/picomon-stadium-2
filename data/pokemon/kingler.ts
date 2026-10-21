import type { PokemonEntry } from "./types";

export default {
  id: "kingler",
  sprite: "/sprites/pokemon-icons/kingler.png",
  ability: "Sheer Force",
  set: {
    moves: ["Agility", "Crabhammer", "Superpower", "Knock Off"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
