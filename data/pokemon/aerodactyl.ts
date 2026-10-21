import type { PokemonEntry } from "./types";

export default {
  id: "aerodactyl",
  sprite: "/sprites/pokemon-icons/aerodactyl.png",
  ability: "Unnerve",
  set: {
    moves: ["Stone Edge", "Earthquake", "Ice Fang", "Roost"],
    item: "Life Orb",
    nature: "Jolly",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
