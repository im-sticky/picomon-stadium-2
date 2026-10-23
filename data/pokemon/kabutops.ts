import type { PokemonEntry } from "./types";

export default {
  id: "kabutops",
  sprite: "/sprites/pokemon-icons/kabutops.png",
  isGreat: true,
  ability: "Battle Armor",
  set: {
    moves: ["Swords Dance", "Waterfall", "Stone Edge", "Aqua Jet"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
