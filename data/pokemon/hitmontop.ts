import type { PokemonEntry } from "./types";

export default {
  id: "hitmontop",
  sprite: "/sprites/pokemon-icons/hitmontop.png",
  ability: "Intimidate",
  set: {
    moves: ["Close Combat", "Sucker Punch", "Rapid Spin", "Mach Punch"],
    item: "Assault Vest",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
