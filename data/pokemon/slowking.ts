import type { PokemonEntry } from "./types";

export default {
  id: "slowking",
  sprite: "/sprites/pokemon-icons/slowking.png",
  ability: "Regenerator",
  baseStats: { hp: 95, atk: 75, def: 80, spa: 100, spd: 120, spe: 30 },
  set: {
    moves: ["Scald", "Psyshock", "Fire Blast", "Slack Off"],
    item: "Leftovers",
    nature: "Calm",
    evs: { hp: 252, def: 4, spd: 252 },
  },
} satisfies PokemonEntry;
