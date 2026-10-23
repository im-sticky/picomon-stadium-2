import type { PokemonEntry } from "./types";

export default {
  id: "omastar",
  sprite: "/sprites/pokemon-icons/omastar.png",
  isGreat: true,
  ability: "Shell Armor",
  set: {
    moves: ["Shell Smash", "Hydro Pump", "Ice Beam", "Earth Power"],
    item: "White Herb",
    nature: "Modest",
    evs: { hp: 4, spa: 252, spe: 252 },
  },
} satisfies PokemonEntry;
