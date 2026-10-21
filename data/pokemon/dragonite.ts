import type { PokemonEntry } from "./types";

export default {
  id: "dragonite",
  sprite: "/sprites/pokemon-icons/dragonite.png",
  isStrong: true,
  ability: "Multiscale",
  set: {
    moves: ["Dragon Dance", "Outrage", "Extreme Speed", "Earthquake"],
    item: "Lum Berry",
    nature: "Adamant",
    evs: { hp: 4, atk: 252, spe: 252 },
  },
} satisfies PokemonEntry;
