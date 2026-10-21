import type { PokemonEntry } from "./types";

export default {
  id: "ariados",
  sprite: "/sprites/pokemon-icons/ariados.png",
  ability: "Insomnia",
  types: ["Bug", "Dark"],
  baseStats: { hp: 70, atk: 90, def: 70, spa: 60, spd: 70, spe: 80 },
  set: {
    moves: ["Sticky Web", "Megahorn", "Sucker Punch", "Poison Jab"],
    item: "Focus Sash",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
