import type { PokemonEntry } from "./types";

export default {
  id: "fearow",
  sprite: "/sprites/pokemon-icons/fearow.png",
  ability: "Sniper",
  baseStats: { hp: 75, atk: 99, def: 65, spa: 66, spd: 66, spe: 101 },
  set: {
    moves: ["Drill Peck", "Drill Run", "U-turn", "Return"],
    item: "Scope Lens",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
