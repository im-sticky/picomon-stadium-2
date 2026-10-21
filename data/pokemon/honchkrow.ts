import type { PokemonEntry } from "./types";

export default {
  id: "honchkrow",
  sprite: "/sprites/pokemon-icons/honchkrow.png",
  ability: "Moxie",
  baseStats: { hp: 105, atk: 125, def: 52, spa: 105, spd: 52, spe: 71 },
  set: {
    moves: ["Brave Bird", "Sucker Punch", "Night Slash", "Superpower"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
