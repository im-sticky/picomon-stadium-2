import type { PokemonEntry } from "./types";

export default {
  id: "raichu",
  sprite: "/sprites/pokemon-icons/raichu.png",
  ability: "Lightning Rod",
  baseStats: { hp: 60, atk: 100, def: 55, spa: 100, spd: 80, spe: 121 },
  set: {
    moves: ["Nasty Plot", "Thunderbolt", "Grass Knot", "Focus Blast"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
