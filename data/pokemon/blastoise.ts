import type { PokemonEntry } from "./types";

export default {
  id: "blastoise",
  sprite: "/sprites/pokemon-icons/blastoise.png",
  isGreat: true,
  ability: "Torrent",
  types: ["Water", "Steel"],
  set: {
    moves: ["Surf", "Ice Beam", "Toxic", "Protect"],
    item: "Leftovers",
    nature: "Bold",
    evs: { hp: 252, def: 252, spd: 4 },
  },
} satisfies PokemonEntry;
