import type { PokemonEntry } from "./types";

export default {
  id: "nidoqueen",
  sprite: "/sprites/pokemon-icons/nidoqueen.png",
  ability: "Sheer Force",
  set: {
    moves: ["Earth Power", "Sludge Wave", "Ice Beam", "Flamethrower"],
    item: "Life Orb",
    nature: "Modest",
    evs: { hp: 252, spa: 252, spd: 4 },
  },
} satisfies PokemonEntry;
