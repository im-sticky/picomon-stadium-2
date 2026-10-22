import type { PokemonEntry } from "./types";

export default {
  id: "glaceon",
  sprite: "/sprites/pokemon-icons/glaceon.png",
  isGreat: true,
  ability: "Snow Warning",
  set: {
    moves: ["Blizzard", "Shadow Ball", "Water Pulse", "Hyper Voice"],
    item: "Choice Specs",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
