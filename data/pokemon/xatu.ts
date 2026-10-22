import type { PokemonEntry } from "./types";

export default {
  id: "xatu",
  sprite: "/sprites/pokemon-icons/xatu.png",
  isGreat: true,
  ability: "Magic Bounce",
  baseStats: { hp: 65, atk: 75, def: 70, spa: 100, spd: 70, spe: 100 },
  set: {
    moves: ["Psychic", "Air Slash", "Heat Wave", "Roost"],
    item: "Life Orb",
    nature: "Timid",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
