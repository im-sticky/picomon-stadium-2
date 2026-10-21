import { describe, expect, it } from 'vitest';
import { draftPickError, draftTurn, picksLeftInTurn, TOTAL_PICKS } from '@/lib/draft';
import type { DraftPick, Slot } from '@/lib/types';

const order = (first: Slot) => Array.from({ length: TOTAL_PICKS }, (_, i) => draftTurn(first, i));

// A made-up pool: two ubers, two strong ones, two holding Life Orb and plenty of
// others. Every other Pokémon holds an item of its own.
const UBERS = ['uberA', 'uberB'];
const STRONG = ['strongA', 'strongB'];
const ORBS = ['orbA', 'orbB'];
const POOL = [...UBERS, ...STRONG, ...ORBS, 'a', 'b', 'c'];
const limits = (id: string) =>
  POOL.includes(id)
    ? { isUber: UBERS.includes(id), isStrong: STRONG.includes(id), item: ORBS.includes(id) ? 'Life Orb' : id }
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

describe('draft pick rules', () => {
  const host: DraftPick[] = [{ slot: 1, pokemonId: 'a' }];

  it('accepts a free Pokémon from the player on turn', () => {
    expect(draftPickError(1, [], 1, 'a', limits)).toBeNull();
    expect(draftPickError(1, host, 2, 'b', limits)).toBeNull();
  });

  it('rejects a pick out of turn', () => {
    expect(draftPickError(1, [], 2, 'a', limits)).toBe('not-your-turn');
    expect(draftPickError(1, host, 1, 'b', limits)).toBe('not-your-turn');
  });

  it('rejects an unknown or already rented Pokémon', () => {
    expect(draftPickError(1, [], 1, 'missingno', limits)).toBe('unknown-pokemon');
    expect(draftPickError(1, host, 2, 'a', limits)).toBe('taken');
  });

  it('allows one uber per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'uberA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError(1, picks, 2, 'uberB', limits)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError(1, more, 1, 'uberB', limits)).toBe('uber-limit');
    expect(draftPickError(1, more, 1, 'c', limits)).toBeNull();
  });

  it('allows one strong per player, on top of one uber', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'strongA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError(1, picks, 2, 'strongB', limits)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError(1, more, 1, 'strongB', limits)).toBe('strong-limit');
    expect(draftPickError(1, more, 1, 'uberA', limits)).toBeNull();
  });

  it('allows each item once per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'orbA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError(1, picks, 2, 'orbB', limits)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError(1, more, 1, 'orbB', limits)).toBe('item-limit');
    expect(draftPickError(1, more, 1, 'c', limits)).toBeNull();
  });

  it('rejects picks after 12', () => {
    const full = order(1).map((slot, i) => ({ slot: slot!, pokemonId: `p${i}` }));
    expect(draftPickError(1, full, 1, 'a', limits)).toBe('draft-complete');
    expect(draftPickError(1, full, 2, 'a', limits)).toBe('draft-complete');
  });
});
