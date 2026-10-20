import type { PokemonEntry } from "./types";

export default {
  id: "ampharos",
  sprite: "/sprites/pokemon-icons/ampharos.png",
  ability: "Static",
  types: ["Electric", "Dragon"],
  baseStats: { hp: 95, atk: 75, def: 90, spa: 125, spd: 95, spe: 65 },
  set: {
    moves: ["Thunderbolt", "Dragon Pulse", "Focus Blast", "Volt Switch"],
    item: "Choice Specs",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
