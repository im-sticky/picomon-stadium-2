import { describe, expect, it } from 'vitest';
import { draftPickError, draftTurn, picksLeftInTurn, TOTAL_PICKS } from '@/lib/draft';
import type { DraftPick, Slot } from '@/lib/types';

const order = (first: Slot) => Array.from({ length: TOTAL_PICKS }, (_, i) => draftTurn(first, i));

// A made-up pool: two ubers and plenty of others.
const POOL: Record<string, boolean> = { uberA: true, uberB: true, a: false, b: false, c: false };
const isUber = (id: string) => POOL[id];

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
    expect(draftPickError(1, [], 1, 'a', isUber)).toBeNull();
    expect(draftPickError(1, host, 2, 'b', isUber)).toBeNull();
  });

  it('rejects a pick out of turn', () => {
    expect(draftPickError(1, [], 2, 'a', isUber)).toBe('not-your-turn');
    expect(draftPickError(1, host, 1, 'b', isUber)).toBe('not-your-turn');
  });

  it('rejects an unknown or already rented Pokémon', () => {
    expect(draftPickError(1, [], 1, 'missingno', isUber)).toBe('unknown-pokemon');
    expect(draftPickError(1, host, 2, 'a', isUber)).toBe('taken');
  });

  it('allows one uber per player', () => {
    const picks: DraftPick[] = [{ slot: 1, pokemonId: 'uberA' }, { slot: 2, pokemonId: 'a' }];
    expect(draftPickError(1, picks, 2, 'uberB', isUber)).toBeNull();
    const more: DraftPick[] = [...picks, { slot: 2, pokemonId: 'b' }];
    expect(draftPickError(1, more, 1, 'uberB', isUber)).toBe('uber-limit');
    expect(draftPickError(1, more, 1, 'c', isUber)).toBeNull();
  });

  it('rejects picks after 12', () => {
    const full = order(1).map((slot, i) => ({ slot: slot!, pokemonId: `p${i}` }));
    expect(draftPickError(1, full, 1, 'a', isUber)).toBe('draft-complete');
    expect(draftPickError(1, full, 2, 'a', isUber)).toBe('draft-complete');
  });
});
