import type { PokemonEntry } from "./types";

export default {
  id: "noctowl",
  sprite: "/sprites/pokemon-icons/noctowl.png",
  ability: "Tinted Lens",
  types: ["Ghost", "Flying"],
  baseStats: { hp: 100, atk: 50, def: 50, spa: 96, spd: 96, spe: 70 },
  set: {
    moves: ["Shadow Ball", "Air Slash", "Hypnosis", "Roost"],
    item: "Zoom Lens",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
