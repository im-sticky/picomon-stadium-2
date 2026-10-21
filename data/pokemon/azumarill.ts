import type { PokemonEntry } from "./types";

export default {
  id: "azumarill",
  sprite: "/sprites/pokemon-icons/azumarill.png",
  ability: "Huge Power",
  baseStats: { hp: 100, atk: 50, def: 80, spa: 90, spd: 80, spe: 50 },
  set: {
    moves: ["Belly Drum", "Aqua Jet", "Play Rough", "Knock Off"],
    item: "Sitrus Berry",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
