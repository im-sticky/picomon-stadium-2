import type { PokemonEntry } from "./types";

export default {
  id: "arcanine",
  sprite: "/sprites/pokemon-icons/arcanine.png",
  isGreat: true,
  ability: "Intimidate",
  set: {
    moves: ["Flare Blitz", "Extreme Speed", "Wild Charge", "Morning Sun"],
    item: "Leftovers",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
