import type {PokemonEntry} from './types';

export default {
  id: 'blastoise',
  sprite: '/sprites/pokemon-icons/blastoise.png',
  isGreat: true,
  ability: 'Mega Launcher',
  types: ['Water', 'Steel'],
  set: {
    moves: ['Flash Cannon', 'Water Pulse', 'Shell Smash', 'Aura Sphere'],
    item: 'White Herb',
    nature: 'Modest',
    evs: {hp: 252, spa: 252, spd: 4},
  },
} satisfies PokemonEntry;
