// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Dex, type PokemonSet } from '@pkmn/sim';
import {
  applyDefault,
  asked,
  choose,
  createBattle,
  createBattleFromSets,
  endResult,
  hasChosen,
  linesFor,
  playerRequest,
  restoreBattle,
  serialize,
  toChoiceString,
  type Engine,
} from '@/lib/battle-engine';
import type { BattleChoice } from '@/lib/battle-types';
import { FORMAT_ID, formatIdFor, RULESET } from '@/lib/pokemon-dex';
import type { BattleSize, Slot } from '@/lib/types';

const SEED = 'sodium,00112233445566778899aabbccddeeff';
// Fixed drafts, so the golden log only changes when the engine or these sets do.
const team1 = ['gengar', 'aerodactyl', 'alakazam', 'ampharos', 'arbok', 'azumarill'];
const team2 = ['arcanine', 'ariados', 'beedrill', 'blissey', 'ambipom', 'crobat'];

/** A hand-written Lv 50 set, for battles that need a specific move. */
const set = (species: string, moves: string[], more: Partial<PokemonSet> = {}): PokemonSet => ({
  name: species,
  species,
  item: '',
  ability: 'No Ability',
  moves,
  nature: 'Hardy',
  gender: '',
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  level: 50,
  ...more,
});
const WALL = { hp: 252, atk: 0, def: 252, spa: 0, spd: 0, spe: 0 };
const bench = Array.from({ length: 5 }, () => set('Snorlax', ['Splash']));
const sets = (...lead: PokemonSet[]) => [...lead, ...bench].slice(0, 6);

/** A 3v3 with the given leads, past the team preview. */
function duel(p1: PokemonSet[], p2: PokemonSet[]): Engine {
  const engine = createBattleFromSets({ size: 3, seed: SEED, sets: { 1: sets(...p1), 2: sets(...p2) } });
  choose(engine, 1, 'team 123');
  choose(engine, 2, 'team 123');
  return engine;
}

/** Both sides choose; returns the public lines the turn added. */
function turn(engine: Engine, c1: string, c2: string): string[] {
  const start = engine.battle.log.length;
  expect(choose(engine, 1, c1)).toEqual({ ok: true });
  expect(choose(engine, 2, c2)).toEqual({ ok: true });
  return linesFor(engine.battle, start, engine.battle.log.length, 0);
}

const pool3 = (size: BattleSize) => createBattle({ size, seed: SEED, teams: { 1: team1, 2: team2 } });
const species = (engine: Engine, slot: Slot) => engine.battle.sides[slot - 1].pokemon.map((p) => p.set.species);

describe('formats', () => {
  it.each([3, 4, 6] as const)('%i a side: the battle runs on gen 6, the picomon mod, and brings that many', (size) => {
    const engine = pool3(size);
    const { battle } = engine;
    expect(battle.gen).toBe(6);
    expect(battle.dex.currentMod).toBe('picomon');
    expect(battle.ruleTable.pickedTeamSize).toBe(size);
    expect(battle.format.id).toBe(formatIdFor(size));
    const request = playerRequest(battle, 1);
    expect(request).toMatchObject({ kind: 'team', size });
    expect(request?.team).toHaveLength(6);

    const order1 = [6, 5, 4, 3, 2, 1].slice(0, size);
    const order2 = [2, 4, 6, 1, 3, 5].slice(0, size);
    const names = { 1: species(engine, 1), 2: species(engine, 2) };
    expect(choose(engine, 1, toChoiceString({ kind: 'team', order: order1 }))).toEqual({ ok: true });
    expect(choose(engine, 2, toChoiceString({ kind: 'team', order: order2 }))).toEqual({ ok: true });
    expect(species(engine, 1)).toEqual(order1.map((i) => names[1][i - 1]));
    expect(species(engine, 2)).toEqual(order2.map((i) => names[2][i - 1]));
  });

  it('keeps Picked Team Size out of the shared ruleset', () => {
    expect(RULESET.some((rule) => rule.includes('Picked Team Size'))).toBe(false);
    expect(Dex.formats.get(FORMAT_ID).exists).toBe(true);
  });

  it('a sized format survives serialize and restore, with its mod and rules', () => {
    const restored = restoreBattle(serialize(pool3(4))).battle;
    expect(restored.format.id).toBe('gen6picomon4v4');
    expect(restored.gen).toBe(6);
    expect(restored.dex.currentMod).toBe('picomon');
    expect(restored.ruleTable.pickedTeamSize).toBe(4);
    expect(restored.ruleTable.has('sleepclausemod')).toBe(true);
    expect(restored.ruleTable.has('endlessbattleclause')).toBe(true);
  });
});

describe('base PP', () => {
  it('Sludge Bomb has 10 max PP, before and after a restore', () => {
    const engine = pool3(3);
    choose(engine, 1, 'team 123');
    choose(engine, 2, 'team 123');
    const sludge = (e: Engine) => {
      const request = playerRequest(e.battle, 1);
      if (request?.kind !== 'move') throw new Error('expected a move request');
      return request.moves.find((m) => m.id === 'sludgebomb');
    };
    expect(sludge(engine)).toMatchObject({ pp: 10, maxpp: 10 });
    expect(sludge(restoreBattle(serialize(engine)))).toMatchObject({ pp: 10, maxpp: 10 });
  });
});

describe('cold restore', () => {
  it('restores on gen 6 and the picomon mod', () => {
    const { battle } = restoreBattle(serialize(pool3(3)));
    expect(battle.gen).toBe(6);
    expect(battle.dex.currentMod).toBe('picomon');
  });

  it('throws rather than fall back to gen 9 when the format is unknown', () => {
    const state = JSON.parse(serialize(pool3(3)));
    state.formatid = 'gen6picomon5v5';
    expect(() => restoreBattle(JSON.stringify(state))).toThrow('battle restored without the picomon format');
  });
});

describe('asked and hasChosen', () => {
  it('a waiting side is null, and reading changes nothing', () => {
    const engine = duel([set('Crobat', ['U-turn'])], [set('Snorlax', ['Splash'])]);
    turn(engine, 'move 1', 'move 1');
    const before = serialize(engine);
    expect(asked(engine.battle, 1)).toBe('switch');
    expect(asked(engine.battle, 2)).toBeNull();
    expect(hasChosen(engine.battle, 1)).toBe(false);
    expect(hasChosen(engine.battle, 2)).toBe(false);
    expect(playerRequest(engine.battle, 2)?.kind).toBe('wait');
    expect(serialize(engine)).toBe(before);
  });

  it('team preview: asked team until locked in', () => {
    const engine = pool3(3);
    expect([asked(engine.battle, 1), asked(engine.battle, 2)]).toEqual(['team', 'team']);
    choose(engine, 1, 'team 321');
    expect(hasChosen(engine.battle, 1)).toBe(true);
    expect(hasChosen(engine.battle, 2)).toBe(false);
  });
});

describe('a rejected choice', () => {
  it('is thrown away: a fresh restore takes a valid choice, with no error saved', () => {
    const engine = duel([set('Tauros', ['Double-Edge', 'Earthquake'], { item: 'Choice Band' })], [set('Blissey', ['Splash'])]);
    turn(engine, 'move 2', 'move 1');
    const state = serialize(engine);
    const rejected = restoreBattle(state);
    const result = choose(rejected, 1, 'move 1');
    expect(result).toEqual({ ok: false, message: expect.stringContaining('disabled') });
    expect(rejected.battle.p1.choice.error).not.toBe('');

    const fresh = restoreBattle(state);
    expect(choose(fresh, 1, 'move 2')).toEqual({ ok: true });
    expect(JSON.parse(serialize(fresh)).sides[0].choice.error).toBe('');
  });
});

describe('battle end', () => {
  // A real Endless Battle Clause win needs 100+ turns of berry cycling, so this
  // asserts the mapping from the engine's own `win(side)`, which the clause calls.
  it('maps a win by the engine to that slot, and a tie to null', () => {
    const won = pool3(3);
    won.battle.win('p2');
    expect(won.battle.ended).toBe(true);
    expect(linesFor(won.battle, 0, won.battle.log.length, 0)).toContain('|win|P2');
    expect(endResult(won.battle, 'normal')).toEqual({ winner: 2, reason: 'normal' });
    expect(asked(won.battle, 1)).toBeNull();
    expect(playerRequest(won.battle, 1)).toBeNull();

    const tied = pool3(3);
    tied.battle.tie();
    expect(linesFor(tied.battle, 0, tied.battle.log.length, 0)).toContain('|tie');
    expect(endResult(tied.battle, 'abandoned')).toEqual({ winner: null, reason: 'abandoned' });
  });
});

describe('determinism', () => {
  // Then each side's default, a fixed choice, until the battle ends.
  const choices = ['team 312', 'team 213', 'move 2', 'move 4'];

  function play(restoreEachTime: boolean): string[] {
    let engine = pool3(3);
    for (let i = 0; !engine.battle.ended; i++) {
      if (restoreEachTime) engine = restoreBattle(serialize(engine));
      const slot = ((i % 2) + 1) as Slot;
      if (i < choices.length) expect(choose(engine, slot, choices[i])).toEqual({ ok: true });
      else applyDefault(engine, slot);
    }
    return linesFor(engine.battle, 0, engine.battle.log.length, 0);
  }

  it('a fixed seed and choices give the same log, with or without a restore before every choice', () => {
    expect(play(true)).toEqual(play(false));
  });

  it('matches the golden log (a regression check for engine upgrades)', () => {
    const engine = pool3(3);
    const start = engine.battle.log.length;
    choose(engine, 1, 'team 123');
    choose(engine, 2, 'team 123');
    turn(engine, 'move 1', 'move 1');
    expect(linesFor(engine.battle, start, engine.battle.log.length, 0)).toEqual(GOLDEN);
  });
});

describe('choice strings', () => {
  it('only ever builds move N, switch N or team digits', () => {
    const all: (BattleChoice | { kind: 'team'; order: number[] })[] = [
      ...([1, 2, 3, 4] as const).map((move) => ({ kind: 'move' as const, move })),
      ...([2, 3, 4, 5, 6] as const).map((slot) => ({ kind: 'switch' as const, slot })),
      { kind: 'team', order: [3, 1, 2] },
      { kind: 'team', order: [6, 5, 4, 3, 2, 1] },
    ];
    for (const choice of all) expect(toChoiceString(choice)).toMatch(/^(move [1-4]|switch [2-6]|team [1-6]{3,6})$/);
    const extra = { kind: 'move', move: 1, mega: true, choice: 'move 1 mega' } as unknown as BattleChoice;
    expect(toChoiceString(extra)).toBe('move 1');
  });
});

describe('steps', () => {
  it('a first choice leaves the log alone; the second resolves the turn', () => {
    const engine = pool3(3);
    choose(engine, 1, 'team 123');
    choose(engine, 2, 'team 123');
    const start = engine.battle.log.length;
    choose(engine, 1, 'move 1');
    expect(engine.battle.log.length).toBe(start);
    choose(engine, 2, 'move 1');
    expect(engine.battle.log.length).toBeGreaterThan(start);
    expect(linesFor(engine.battle, start, engine.battle.log.length, 0)).toContain('|upkeep');
  });

  it('a U-turn is a step with no |turn|: the user switches and the other side waits', () => {
    const engine = duel([set('Crobat', ['U-turn'])], [set('Snorlax', ['Splash'])]);
    const lines = turn(engine, 'move 1', 'move 1');
    expect(lines.some((l) => l.startsWith('|move|p1a: Crobat|U-turn'))).toBe(true);
    expect(lines.some((l) => l.startsWith('|turn|'))).toBe(false);
    expect([asked(engine.battle, 1), asked(engine.battle, 2)]).toEqual(['switch', null]);
  });
});

describe('defaults', () => {
  it('team: the first N in draft order', () => {
    const engine = pool3(4);
    const names = species(engine, 1);
    applyDefault(engine, 1);
    applyDefault(engine, 2);
    expect(species(engine, 1)).toEqual(names.slice(0, 4));
  });

  it('move: the first one that is not disabled', () => {
    const engine = duel([set('Tauros', ['Double-Edge', 'Earthquake'], { item: 'Choice Band' })], [set('Blissey', ['Splash'])]);
    turn(engine, 'move 2', 'move 1');
    const start = engine.battle.log.length;
    applyDefault(engine, 1);
    applyDefault(engine, 2);
    const lines = linesFor(engine.battle, start, engine.battle.log.length, 0);
    expect(lines.some((l) => l.startsWith('|move|p1a: Tauros|Earthquake'))).toBe(true);
  });

  it('move: Struggle once every move is out of PP', () => {
    const engine = duel([set('Gengar', ['Destiny Bond'])], [set('Blissey', ['Splash'])]);
    for (let i = 0; i < 5; i++) turn(engine, 'move 1', 'move 1');
    const request = playerRequest(engine.battle, 1);
    expect(request).toMatchObject({ kind: 'move', moves: [{ move: 1, id: 'struggle' }] });
    const start = engine.battle.log.length;
    applyDefault(engine, 1);
    applyDefault(engine, 2);
    const lines = linesFor(engine.battle, start, engine.battle.log.length, 0);
    expect(lines.some((l) => l.startsWith('|move|p1a: Gengar|Struggle'))).toBe(true);
  });

  it('forced switch: the first healthy bench Pokémon', () => {
    const engine = duel(
      [set('Golem', ['Explosion']), set('Chansey', ['Splash'])],
      [set('Blissey', ['Splash'], { evs: WALL })],
    );
    turn(engine, 'move 1', 'move 1');
    expect([asked(engine.battle, 1), asked(engine.battle, 2)]).toEqual(['switch', null]);
    applyDefault(engine, 1);
    expect(engine.battle.p1.active[0].set.species).toBe('Chansey');
  });

  it('does nothing for a slot that is not asked', () => {
    const engine = duel([set('Crobat', ['U-turn'])], [set('Snorlax', ['Splash'])]);
    turn(engine, 'move 1', 'move 1');
    const before = serialize(engine);
    applyDefault(engine, 2);
    expect(serialize(engine)).toBe(before);
  });
});

describe('faint replacements', () => {
  it('a single faint asks only that side to switch', () => {
    const engine = duel([set('Golem', ['Explosion'])], [set('Blissey', ['Splash'], { evs: WALL })]);
    turn(engine, 'move 1', 'move 1');
    expect(engine.battle.p2.active[0].fainted).toBe(false);
    expect([asked(engine.battle, 1), asked(engine.battle, 2)]).toEqual(['switch', null]);
    expect(playerRequest(engine.battle, 2)?.kind).toBe('wait');
  });

  it("a double faint asks both; neither sees the other's switch until both are in; a timeout defaults one side", () => {
    const engine = duel([set('Golem', ['Explosion'])], [set('Magikarp', ['Splash']), set('Chansey', ['Splash'])]);
    turn(engine, 'move 1', 'move 1');
    expect([asked(engine.battle, 1), asked(engine.battle, 2)]).toEqual(['switch', 'switch']);

    const start = engine.battle.log.length;
    expect(choose(engine, 1, 'switch 3')).toEqual({ ok: true });
    expect(engine.battle.log.length).toBe(start);
    expect(hasChosen(engine.battle, 1)).toBe(true);

    applyDefault(engine, 2);
    const lines = linesFor(engine.battle, start, engine.battle.log.length, 0);
    const switches = lines.filter((l) => l.startsWith('|switch|'));
    expect(switches).toHaveLength(2);
    expect(switches).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\|switch\|p1a: Snorlax/),
        expect.stringMatching(/^\|switch\|p2a: Chansey/),
      ]),
    );
  });
});

describe('secrecy of views', () => {
  const engine = pool3(3);
  choose(engine, 1, 'team 123');
  choose(engine, 2, 'team 123');
  const all = (channel: 0 | Slot) => linesFor(engine.battle, 0, engine.battle.log.length, channel);
  const exact = (slot: Slot) => {
    const p = engine.battle.sides[slot - 1].active[0];
    return `|switch|p${slot}a: ${p.name}|${p.details}|${p.hp}/${p.maxhp}`;
  };

  it("each player sees only their own exact HP; the public lines have none", () => {
    expect(all(1)).toContain(exact(1));
    expect(all(2)).not.toContain(exact(1));
    expect(all(2)).toContain(exact(2));
    expect(all(1)).not.toContain(exact(2));
    expect(all(0)).not.toContain(exact(1));
    expect(all(0)).not.toContain(exact(2));
    expect(all(0).filter((l) => l.startsWith('|switch|')).every((l) => /\|\d+\/100$/.test(l))).toBe(true);
  });

  it("a player's request holds only their own team, and no view holds the seed or input log", () => {
    const mine = JSON.stringify(playerRequest(engine.battle, 2));
    for (const p of engine.battle.p1.pokemon) expect(mine).not.toContain(`"${p.details}"`);
    for (const slot of [1, 2] as const) {
      const text = JSON.stringify([playerRequest(engine.battle, slot), all(slot)]);
      expect(text).not.toContain(SEED.slice('sodium,'.length));
      expect(text).not.toContain('>start');
      expect(text).not.toContain('>player');
    }
  });
});

const GOLDEN = [
  '|',
  '|teamsize|p1|3',
  '|teamsize|p2|3',
  '|start',
  '|switch|p1a: Gengar|Gengar, L50, F|100/100',
  '|switch|p2a: Arcanine|Arcanine, L50, M|100/100',
  '|-ability|p2a: Arcanine|Intimidate|boost',
  '|-unboost|p1a: Gengar|atk|1',
  '|turn|1',
  '|',
  '|move|p1a: Gengar|Shadow Ball|p2a: Arcanine',
  '|-damage|p2a: Arcanine|25/100',
  '|-damage|p1a: Gengar|91/100|[from] item: Life Orb',
  '|move|p2a: Arcanine|Flare Blitz|p1a: Gengar',
  '|-damage|p1a: Gengar|0 fnt',
  '|faint|p1a: Gengar',
  '|-damage|p2a: Arcanine|0 fnt|[from] Recoil',
  '|faint|p2a: Arcanine',
  '|',
  '|upkeep',
];
