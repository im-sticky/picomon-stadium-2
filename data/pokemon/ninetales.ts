import type {PokemonEntry} from './types';

export default {
  id: 'ninetales',
  sprite: '/sprites/pokemon-icons/ninetales.png',
  isGreat: true,
  ability: 'Drought',
  types: ['Fire', 'Ghost'],
  set: {
    moves: ['Nasty Plot', 'Fire Blast', 'Hex', 'Solar Beam'],
    item: 'Heat Rock',
    nature: 'Timid',
    evs: {hp: 4, spa: 252, spe: 252},
  },
} satisfies PokemonEntry;
