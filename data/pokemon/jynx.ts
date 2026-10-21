import type { PokemonEntry } from "./types";

export default {
  id: "jynx",
  sprite: "/sprites/pokemon-icons/jynx.png",
  ability: "Dry Skin",
  baseStats: { hp: 70, atk: 60, def: 40, spa: 120, spd: 100, spe: 95 },
  set: {
    moves: ["Lovely Kiss", "Ice Beam", "Psyshock", "Nasty Plot"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
