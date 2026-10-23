import { describe, expect, it } from 'vitest';
import { draftPickError, draftTurn, inDraftPool, picksLeftInTurn, TOTAL_PICKS } from '@/lib/draft';
import type { DraftPick, Slot } from '@/lib/types';

const order = (first: Slot) => Array.from({ length: TOTAL_PICKS }, (_, i) => draftTurn(first, i));

// A made-up pool: two masters, two ultra ones, two great ones, two holding Life Orb
// and plenty of others. Every other Pokémon holds an item of its own.
const MASTERS = ['masterA', 'masterB'];
const ULTRA = ['ultraA', 'ultraB'];
const GREAT = ['greatA', 'greatB'];
const ORBS = ['orbA', 'orbB'];
const POOL = [...MASTERS, ...ULTRA, ...GREAT, ...ORBS, 'a', 'b', 'c'];
const limits = (id: string) =>
  POOL.includes(id)
    ? {
        isMaster: MASTERS.includes(id),
        isUltra: ULTRA.includes(id),
        isGreat: GREAT.includes(id),
        item: ORBS.includes(id) ? 'Life Orb' : id,
      }
    : undefined;

describe('draft turn order', () => {
  it('snakes from the host when the host drafts first', () => {
    expect(order(1)).toEqual([1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1]);
  });

  it('snakes from the guest when the guest drafts first', () => {
    expect(order(2)).toEqual([2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2]);
  });

  it('gives each player 6 picks and no turn after 12', () => {
    expect(order(1).filter((s) => s === 1)).toHaveLength(6);
    expect(order(2).filter((s) => s === 1)).toHaveLength(6);
    expect(draftTurn(1, TOTAL_PICKS)).toBeNull();
  });

  it('counts the picks left in the current turn', () => {
    expect([0, 1, 2, 3, 11, 12].map((i) => picksLeftInTurn(1, i))).toEqual([1, 2, 1, 2, 1, 0]);
  });
});

describe('standard draft pick rules', () => {
  const host: DraftPick[] = [{ slot: 1, pokemonId: 'a' }];

  it('accepts a free Pokémon from the player on turn', () => {
    expect(draftPickError('standard', 1, [], 1, 'a', limits)).toBeNull();
    expect(draftPickError('standard', 1, host, 2, 'b', limits)).toBeNull();
  });

  it('rejects a pick out of turn', () => {
    expect(draftPickError('standard', 1, [], 2, 'a', limits)).toBe('not-your-turn');
    expect(draftPickError('standard', 1, host, 1, 'b', limits)).toBe('not-your-turn');
  });

  it('rejects an unknown or already rented Pokémon', () => {
    expect(draftPickError('standard', 1, [], 1, 'missingno', limits)).toBe('unknown-pokemon');
    expect(draftPickError('standard', 1, host, 2, 'a', limits)).toBe('taken');
  });

  it('allows one master per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'masterA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError('standard', 1, picks, 2, 'masterB', limits)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError('standard', 1, more, 1, 'masterB', limits)).toBe('master-limit');
    expect(draftPickError('standard', 1, more, 1, 'c', limits)).toBeNull();
  });

  it('allows one ultra per player, on top of one master', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'ultraA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError('standard', 1, picks, 2, 'ultraB', limits)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError('standard', 1, more, 1, 'ultraB', limits)).toBe('ultra-limit');
    expect(draftPickError('standard', 1, more, 1, 'masterA', limits)).toBeNull();
  });

  it('allows each item once per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'orbA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError('standard', 1, picks, 2, 'orbB', limits)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError('standard', 1, more, 1, 'orbB', limits)).toBe('item-limit');
    expect(draftPickError('standard', 1, more, 1, 'c', limits)).toBeNull();
  });

  it('rejects picks after 12', () => {
    const full = order(1).map((slot, i) => ({ slot: slot!, pokemonId: `p${i}` }));
    expect(draftPickError('standard', 1, full, 1, 'a', limits)).toBe('draft-complete');
    expect(draftPickError('standard', 1, full, 2, 'a', limits)).toBe('draft-complete');
  });
});

describe('unlimited draft pick rules', () => {
  it('allows any number of masters and ultra ones per player', () => {
    const picks: DraftPick[] = [
      { slot: 1, pokemonId: 'masterA' },
      { slot: 2, pokemonId: 'a' },
      { slot: 2, pokemonId: 'b' },
    ];
    expect(draftPickError('unlimited', 1, picks, 1, 'masterB', limits)).toBeNull();
    const ultras: DraftPick[] = [
      { slot: 1, pokemonId: 'ultraA' },
      { slot: 2, pokemonId: 'a' },
      { slot: 2, pokemonId: 'b' },
    ];
    expect(draftPickError('unlimited', 1, ultras, 1, 'ultraB', limits)).toBeNull();
  });

  it('still allows each Pokémon once and each item once per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'orbA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError('unlimited', 1, picks, 2, 'orbA', limits)).toBe('taken');
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError('unlimited', 1, more, 1, 'orbB', limits)).toBe('item-limit');
  });

  it('still checks turns and unknown Pokémon', () => {
    expect(draftPickError('unlimited', 1, [], 2, 'a', limits)).toBe('not-your-turn');
    expect(draftPickError('unlimited', 1, [], 1, 'missingno', limits)).toBe('unknown-pokemon');
  });
});

describe('poké ball draft pick rules', () => {
  it('only has Poké Ball tier Pokémon in the pool', () => {
    const tier = (id: string) => inDraftPool('pokeball', limits(id)!);
    expect([...MASTERS, ...ULTRA, ...GREAT].map(tier)).toEqual([false, false, false, false, false, false]);
    expect(['a', 'b', 'orbA'].map(tier)).toEqual([true, true, true]);
    for (const type of ['standard', 'unlimited'] as const) {
      expect(POOL.every((id) => inDraftPool(type, limits(id)!))).toBe(true);
    }
  });

  it('rejects any Pokémon outside the pool', () => {
    for (const id of [...MASTERS, ...ULTRA, ...GREAT]) {
      expect(draftPickError('pokeball', 1, [], 1, id, limits)).toBe('not-in-pool');
    }
    expect(draftPickError('pokeball', 1, [], 1, 'a', limits)).toBeNull();
  });

  it('still allows each Pokémon once and each item once per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'orbA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError('pokeball', 1, picks, 2, 'orbA', limits)).toBe('taken');
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError('pokeball', 1, more, 1, 'orbB', limits)).toBe('item-limit');
    expect(draftPickError('pokeball', 1, more, 1, 'c', limits)).toBeNull();
  });

  it('checks the turn before the pool', () => {
    expect(draftPickError('pokeball', 1, [], 2, 'greatA', limits)).toBe('not-your-turn');
  });
});
