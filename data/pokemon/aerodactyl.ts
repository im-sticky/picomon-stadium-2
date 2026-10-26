import type { PokemonEntry } from "./types";

export default {
  id: "aerodactyl",
  sprite: "/sprites/pokemon-icons/aerodactyl.png",
  isGreat: true,
  ability: "Unnerve",
  set: {
    moves: ["Stone Edge", "Earthquake", "Ice Fang", "Roost"],
    item: "King's Rock",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
