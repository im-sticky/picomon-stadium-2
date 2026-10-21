import { Battle, extractChannelMessages, Teams, toID, type PokemonSet, type Side } from "@pkmn/sim";
import type { Asked, BattleChoice, BattleResult, EndReason, MoveOption, PlayerRequest, TeamMember } from "@/lib/battle-types";
import { formatIdFor, getPokemon, MOD_ID, toSet } from "@/lib/pokemon-dex";
import type { BattleSize, Slot } from "@/lib/types";

// A pure wrapper around `@pkmn/sim`: no database, server only. Requests come from
// `side.activeRequest` and lines from `battle.log`, both of which the snapshot keeps.

/** A live battle plus the `|error|` texts its `send` callback has seen. */
export type Engine = { battle: Battle; errors: string[] };

type Request = NonNullable<Side["activeRequest"]>;

const sideOf = (battle: Battle, slot: Slot) => battle.sides[slot - 1];

/** Collects every `|error|` line from `sideupdate`. Nothing else from `send` is used. */
function collector(errors: string[]) {
  return (type: string, data: string | string[]) => {
    if (type !== "sideupdate") return;
    const text = Array.isArray(data) ? data.join("\n") : data;
    for (const line of text.split("\n")) {
      if (line.startsWith("|error|")) errors.push(line.slice("|error|".length));
    }
  };
}

function newSeed(): `sodium,${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `sodium,${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A new battle from each slot's six sets, in draft order. Players are named P1 and
 * P2, not their Home names, which may hold protocol characters like `|`.
 */
export function createBattleFromSets(opts: {
  size: BattleSize;
  seed?: string;
  sets: { 1: PokemonSet[]; 2: PokemonSet[] };
}): Engine {
  const errors: string[] = [];
  const battle = new Battle({
    formatid: formatIdFor(opts.size),
    seed: (opts.seed ?? newSeed()) as `sodium,${string}`,
    send: collector(errors),
  });
  battle.setPlayer("p1", { name: "P1", team: Teams.pack(opts.sets[1]) });
  battle.setPlayer("p2", { name: "P2", team: Teams.pack(opts.sets[2]) });
  return { battle, errors };
}

/** A new battle from each slot's drafted ids, in draft order. */
export function createBattle(opts: { size: BattleSize; seed?: string; teams: { 1: string[]; 2: string[] } }): Engine {
  const sets = (ids: string[]) =>
    ids.map((id) => {
      const entry = getPokemon(id);
      if (!entry) throw new Error(`unknown Pokémon "${id}"`);
      return toSet(entry);
    });
  return createBattleFromSets({ size: opts.size, seed: opts.seed, sets: { 1: sets(opts.teams[1]), 2: sets(opts.teams[2]) } });
}

/**
 * Loads a saved snapshot. `fromJSON` quietly falls back to the latest generation
 * when the format isn't registered, so check it came back on our mod.
 */
export function restoreBattle(state: string): Engine {
  const errors: string[] = [];
  const battle = Battle.fromJSON(state);
  battle.restart(collector(errors));
  if (battle.gen !== 6 || battle.dex.currentMod !== MOD_ID) {
    throw new Error("battle restored without the picomon format");
  }
  return { battle, errors };
}

export function serialize(engine: Engine): string {
  return JSON.stringify(engine.battle.toJSON());
}

/** What the engine asks `slot` for. Reads only `activeRequest`, never `requestState`. */
export function asked(battle: Battle, slot: Slot): Asked {
  const request = sideOf(battle, slot).activeRequest;
  if (!request || battle.ended || request.wait) return null;
  if (request.teamPreview) return "team";
  if (request.forceSwitch) return "switch";
  return "move";
}

/**
 * Whether `slot` has a complete choice in for this step, with no side effects.
 * Only meaningful while `asked(battle, slot)` isn't null. (`isChoiceDone()` can
 * auto-pass, so reads never call it.)
 */
export function hasChosen(battle: Battle, slot: Slot): boolean {
  const side = sideOf(battle, slot);
  switch (asked(battle, slot)) {
    case "team":
      return side.choice.actions.length >= side.pickedTeamSize();
    case "switch":
      return side.choice.forcedSwitchesLeft === 0 && side.choice.actions.length > 0;
    case "move":
      return side.choice.actions.length > 0;
    default:
      return false;
  }
}

/** The engine string for a structured choice. Only ever `move N`, `switch N` or `team 123…`. */
export function toChoiceString(choice: BattleChoice | { kind: "team"; order: number[] }): string {
  switch (choice.kind) {
    case "move":
      return `move ${choice.move}`;
    case "switch":
      return `switch ${choice.slot}`;
    case "team":
      return `team ${choice.order.join("")}`;
  }
}

/** Submits a choice string. On a rejection the engine has changed, so throw it away. */
export function choose(engine: Engine, slot: Slot, choice: string): { ok: true } | { ok: false; message: string } {
  const before = engine.errors.length;
  if (engine.battle.choose(sideOf(engine.battle, slot).id, choice)) return { ok: true };
  return { ok: false, message: engine.errors.slice(before).join("\n") || "Invalid choice." };
}

/** The engine's own choice for `slot` (a timeout). Does nothing if it isn't being asked. */
export function applyDefault(engine: Engine, slot: Slot): void {
  if (asked(engine.battle, slot) === null) return;
  engine.battle.choose(sideOf(engine.battle, slot).id, "default");
}

export function forfeit(engine: Engine, loser: Slot): void {
  engine.battle.forceWin(sideOf(engine.battle, loser === 1 ? 2 : 1).id);
}

/** Both players walked away: a tie. */
export function abandon(engine: Engine): void {
  engine.battle.tie();
}

export function endResult(battle: Battle, reason: EndReason): BattleResult {
  const winner = battle.winner === "P1" ? 1 : battle.winner === "P2" ? 2 : null;
  return { winner, reason };
}

/**
 * `battle.log[from..to)` as `channel` sees it: 0 is the public (spectator) view,
 * a slot gets its own exact-HP lines too. `|t:|` wall-clock lines are dropped.
 */
export function linesFor(battle: Battle, from: number, to: number, channel: 0 | Slot): string[] {
  const text = battle.log.slice(from, to).join("\n");
  return extractChannelMessages(text, [channel])[channel].filter((line) => !line.startsWith("|t:|"));
}

function teamOf(battle: Battle, slot: Slot, request: Request): TeamMember[] {
  const pokemon = sideOf(battle, slot).pokemon;
  return request.side.pokemon.map((p, i) => {
    const [hpText, status] = p.condition.split(" ");
    const [hp, maxhp] = hpText.split("/").map(Number);
    const fainted = status === "fnt";
    return {
      position: i + 1,
      pokemonId: toID(pokemon[i].set.species),
      details: p.details,
      hp,
      maxhp: maxhp ?? pokemon[i].maxhp,
      status: status && !fainted ? status : null,
      fainted,
      active: p.active,
      stats: { ...p.stats },
      item: p.item,
      ability: p.baseAbility,
      moves: [...p.moves],
    };
  });
}

/** The engine's request for `slot`, in the API's shape; null once the battle is over. */
export function playerRequest(battle: Battle, slot: Slot): PlayerRequest | null {
  const request = sideOf(battle, slot).activeRequest;
  if (!request || battle.ended) return null;
  const team = teamOf(battle, slot, request);
  if (request.wait) return { kind: "wait", team };
  if (request.teamPreview) return { kind: "team", size: battle.ruleTable.pickedTeamSize as BattleSize, team };
  if (request.forceSwitch) return { kind: "switch", team };
  const active = request.active[0];
  const moves: MoveOption[] = active.moves.map((m, i) => ({
    move: i + 1,
    id: m.id,
    name: m.move,
    pp: m.pp ?? 0,
    maxpp: m.maxpp ?? 0,
    disabled: !!m.disabled,
    target: m.target ?? "",
  }));
  const trapped = !!active.trapped;
  const bench = team.some((m) => !m.active && !m.fainted);
  // `maybeTrapped` counts as switchable: the engine rejects the switch if it really is.
  return { kind: "move", moves, canSwitch: !trapped && bench, trapped, team };
}
