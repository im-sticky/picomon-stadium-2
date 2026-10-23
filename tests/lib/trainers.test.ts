import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH } from '@/lib/names';
import { isTrainer, playerFromTrainer, trainerName, TRAINERS } from '@/lib/trainers';

describe('trainers', () => {
  it('lists every sprite in public/sprites/trainers once', () => {
    const files = readdirSync('public/sprites/trainers')
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace(/\.png$/, ''));
    expect([...TRAINERS].sort()).toEqual(files.sort());
    expect(new Set(TRAINERS).size).toBe(TRAINERS.length);
  });

  it('starts with Gold, Kris and Silver and ends with Giovanni', () => {
    expect(TRAINERS.slice(0, 3)).toEqual(['gold', 'kris', 'silver']);
    expect(TRAINERS.at(-1)).toBe('giovanni');
  });

  it('names each trainer in title case with _ as a space, within the name limit', () => {
    expect(trainerName('lt_surge')).toBe('Lt Surge');
    expect(trainerName('gold')).toBe('Gold');
    for (const key of TRAINERS) expect(trainerName(key).length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
  });

  it("makes a player from a trainer key: the trainer's name is the player's name", () => {
    expect(playerFromTrainer('lt_surge')).toEqual({ name: 'Lt Surge', trainer: 'lt_surge' });
    for (const bad of ['', 'Gold', 'ash', undefined, null, 3]) {
      expect(isTrainer(bad)).toBe(false);
      expect(playerFromTrainer(bad)).toBeNull();
    }
  });
});
