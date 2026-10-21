import type { PokemonEntry } from "./types";

export default {
  id: "machamp",
  sprite: "/sprites/pokemon-icons/machamp.png",
  ability: "No Guard",
  set: {
    moves: ["Dynamic Punch", "Knock Off", "Stone Edge", "Bullet Punch"],
    item: "Assault Vest",
    nature: "Adamant",
    evs: { hp: 252, atk: 252, spd: 4 },
  },
} satisfies PokemonEntry;
