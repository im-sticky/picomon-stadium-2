import type { PokemonEntry } from "./types";

export default {
  id: "entei",
  sprite: "/sprites/pokemon-icons/entei.png",
  isUltra: true,
  ability: "Flash Fire",
  set: {
    moves: ["Sacred Fire", "Extreme Speed", "Stone Edge", "Iron Head"],
    item: "Choice Band",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
