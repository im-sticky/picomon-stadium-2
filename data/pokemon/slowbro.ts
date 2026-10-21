import type { PokemonEntry } from "./types";

export default {
  id: "slowbro",
  sprite: "/sprites/pokemon-icons/slowbro.png",
  ability: "Regenerator",
  baseStats: { hp: 95, atk: 75, def: 120, spa: 100, spd: 80, spe: 30 },
  set: {
    moves: ["Calm Mind", "Scald", "Psyshock", "Slack Off"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
