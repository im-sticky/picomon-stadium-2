import type { PokemonEntry } from "./types";

export default {
  id: "victreebel",
  sprite: "/sprites/pokemon-icons/victreebel.png",
  ability: "Gluttony",
  baseStats: { hp: 80, atk: 115, def: 65, spa: 110, spd: 70, spe: 70 },
  set: {
    moves: ["Swords Dance", "Power Whip", "Knock Off", "Sucker Punch"],
    item: "Life Orb",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
