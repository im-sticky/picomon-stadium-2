import type { PokemonEntry } from "./types";

export default {
  id: "exeggutor",
  sprite: "/sprites/pokemon-icons/exeggutor.png",
  ability: "Harvest",
  set: {
    moves: ["Giga Drain", "Psychic", "Sleep Powder", "Leech Seed"],
    item: "Sitrus Berry",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
