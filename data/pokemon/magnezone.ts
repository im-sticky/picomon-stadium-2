import type { PokemonEntry } from "./types";

export default {
  id: "magnezone",
  sprite: "/sprites/pokemon-icons/magnezone.png",
  isGreat: true,
  ability: "Levitate",
  set: {
    moves: ["Thunderbolt", "Flash Cannon", "Volt Switch", "Tri Attack"],
    item: "Choice Specs",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
