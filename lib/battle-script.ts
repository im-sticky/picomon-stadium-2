import type { Slot } from "@/lib/types";

// Turns a battle step's protocol lines into "beats": what the battle screen shows,
// one moment at a time (a message, an HP bar moving, a send-out, an ability box).
// Pure and client-safe. The server's lines are the only source: nothing here
// predicts an outcome, and the opponent's HP is only ever the protocol's
// percentage, never an exact number.

/** Two lines of the message box. */
export type Message = readonly [string, string];
export type Side = "me" | "opp";
export type Status = "par" | "brn" | "slp" | "frz" | "psn" | "tox";

/**
 * A Pokémon on the field. Yours has exact HP; the opponent's is out of 100 (the
 * protocol's percentage, `maxhp` 100).
 */
export type Battler = {
  name: string;
  pokemonId: string;
  hp: number;
  maxhp: number;
  status: Status | null;
  fainted: boolean;
};

export type AbilityBox = { side: Side; name: string; ability: string };

export type Scene = {
  /** The intro: the opponent's trainer and both teams' balls, before the first send-out. */
  intro: boolean;
  active: Record<Side, Battler | null>;
  /** Bumped by every send-out, so the sprite plays its entrance once. */
  entrances: Record<Side, number>;
  message: Message;
  ability: AbilityBox | null;
};

/** One moment of the playback. Effects apply together, then it holds for `hold` ms. */
export type Beat = {
  hold: number;
  message?: Message;
  ability?: AbilityBox;
  intro?: boolean;
  switchIn?: { side: Side; battler: Battler };
  hp?: { side: Side; name: string; hp: number; maxhp?: number; status?: Status | null };
  status?: { side: Side; name: string; status: Status | null };
  faint?: { side: Side; name: string };
};

export type ScriptContext = {
  you: Slot;
  /** Both players' names, as screens show them (uppercase). */
  names: { 1: string; 2: string };
  /**
   * True for your own lines (from your view), where your HP is exact. The public
   * lines in a `battle-step` give your HP out of 100 too: then `maxHpOf` turns it
   * back into numbers from your team's max HP.
   */
  exact: boolean;
  maxHpOf?: (name: string) => number | undefined;
};

export const HOLD = {
  intro: 2200,
  oppSendOut: 1800,
  mySendOut: 1500,
  message: 1600,
  hp: 1000,
  ability: 2000,
  abilityText: 2400,
  faint: 1800,
} as const;

export const EMPTY: Message = ["", ""];

export const initialScene = (): Scene => ({
  intro: true,
  active: { me: null, opp: null },
  entrances: { me: 0, opp: 0 },
  message: EMPTY,
  ability: null,
});

const STATUSES = ["par", "brn", "slp", "frz", "psn", "tox"] as const;
const isStatus = (s: string | undefined): s is Status => (STATUSES as readonly string[]).includes(s ?? "");

/** Showdown's id: lowercase letters and digits only. */
export const toId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

const up = (s: string) => s.toUpperCase();
const msg = (a: string, b = ""): Message => [a, b];

const STAT_NAMES: Record<string, string> = {
  atk: "ATTACK",
  def: "DEFENSE",
  spa: "SP. ATK",
  spd: "SP. DEF",
  spe: "SPEED",
  accuracy: "ACCURACY",
  evasion: "EVASION",
};

type Ident = { slot: Slot; name: string };

/** `p2a: Gyarados` → slot 2, "Gyarados". `p2: P2` (a side) gives the player's slot and engine name. */
function parseIdent(text: string | undefined): Ident | null {
  const m = /^p([12])[a-z]?: ?(.*)$/.exec(text ?? "");
  return m ? { slot: Number(m[1]) as Slot, name: m[2] } : null;
}

/** "127/171 par", "0 fnt", "100/100". */
function parseCondition(text: string): { hp: number; maxhp?: number; status: Status | null; fainted: boolean } {
  const [hpText, extra] = text.trim().split(" ");
  const [hp, maxhp] = hpText.split("/").map(Number);
  const fainted = extra === "fnt" || hp === 0;
  return { hp: hp || 0, maxhp: Number.isFinite(maxhp) ? maxhp : undefined, status: isStatus(extra) ? extra : null, fainted };
}

/** The positional args and the `[tag] value` keyword args of one line. */
function split(line: string): { args: string[]; tags: Record<string, string> } {
  const parts = line.split("|").slice(1);
  const args: string[] = [];
  const tags: Record<string, string> = {};
  for (const part of parts) {
    const m = /^\[(\w+)\]\s*(.*)$/.exec(part);
    if (m) tags[m[1]] = m[2];
    else args.push(part);
  }
  return { args, tags };
}

/** "move: Stealth Rock" / "ability: Intimidate" / "item: Leftovers" / "psn" → its kind and name. */
function effect(text: string | undefined): { kind: "move" | "ability" | "item" | ""; name: string } {
  const m = /^(move|ability|item): ?(.*)$/.exec(text ?? "");
  return m ? { kind: m[1] as "move" | "ability" | "item", name: m[2] } : { kind: "", name: text ?? "" };
}

/** Splits a long sentence over the two lines (about 40 characters each). */
export function wrapMessage(text: string, width = 40): Message {
  if (text.length <= width) return [text, ""];
  const words = text.split(" ");
  let first = "";
  while (words.length && (first ? first.length + 1 : 0) + words[0].length <= width) {
    first = first ? `${first} ${words.shift()}` : words.shift()!;
  }
  return [first, words.join(" ")];
}

const HEAL_ITEMS = new Set(["Leftovers", "Black Sludge", "Shell Bell"]);

/**
 * The beats for one step's lines, in order. The intro (the step with `|start`)
 * opens with "<OPP> wants to battle!" and sends the opponent's Pokémon out first.
 */
export function stepBeats(lines: readonly string[], ctx: ScriptContext): Beat[] {
  const opponent: Slot = ctx.you === 1 ? 2 : 1;
  const sideOf = (slot: Slot): Side => (slot === ctx.you ? "me" : "opp");
  const player = (slot: Slot) => ctx.names[slot];

  // The intro's two send-outs, opponent first, whatever order the log has them in.
  const ordered = [...lines];
  const start = ordered.indexOf("|start");
  if (start >= 0) {
    let end = start + 1;
    while (end < ordered.length && ordered[end].startsWith("|switch|")) end++;
    const sendOuts = ordered.slice(start + 1, end);
    sendOuts.sort((a, b) => Number(parseIdent(split(b).args[1])?.slot === opponent) - Number(parseIdent(split(a).args[1])?.slot === opponent));
    ordered.splice(start + 1, sendOuts.length, ...sendOuts);
  }

  const beats: Beat[] = [];
  const say = (message: Message, hold: number = HOLD.message, more: Omit<Beat, "hold" | "message"> = {}) =>
    beats.push({ hold, message, ...more });
  const box = (owner: Ident | null, ability: string) => {
    if (owner) beats.push({ hold: HOLD.ability, ability: { side: sideOf(owner.slot), name: up(owner.name), ability } });
  };

  /** Your HP from a line: exact in your own lines, back from out-of-100 in public ones. */
  const hpFor = (who: Ident, text: string) => {
    const c = parseCondition(text);
    if (who.slot !== ctx.you) return { ...c, maxhp: 100 };
    if (ctx.exact) return c;
    const max = ctx.maxHpOf?.(who.name);
    if (!max) return c;
    const hp = c.fainted ? 0 : Math.max(c.hp > 0 ? 1 : 0, Math.round((c.hp * max) / 100));
    return { ...c, hp, maxhp: max };
  };

  let previous: { type: string; args: string[] } | null = null;

  for (const line of ordered) {
    const { args, tags } = split(line);
    const type = args[0] ?? "";
    const who = parseIdent(args[1]);
    const name = who ? up(who.name) : "";
    const from = effect(tags.from);
    const of = parseIdent(tags.of);
    const ofName = of ? up(of.name) : "";
    const silent = "silent" in tags;

    // An ability that caused this line shows its box first. Heals, boosts, immunities
    // and cures come from the Pokémon's own ability; the rest from `[of]` when given.
    if (from.kind === "ability" && type !== "-ability" && !silent) {
      const own = ["-heal", "-boost", "-immune", "-curestatus", "-activate", "-clearnegativeboost"].includes(type);
      box(own ? who : (of ?? who), from.name);
    }

    switch (type) {
      case "start":
        say(msg(`${player(opponent)} wants`, "to battle!"), HOLD.intro, { intro: true });
        break;

      case "switch":
      case "drag":
      case "replace": {
        if (!who) break;
        const c = hpFor(who, args[3] ?? "");
        const battler: Battler = {
          name: who.name,
          pokemonId: toId((args[2] ?? who.name).split(",")[0]),
          hp: c.hp,
          maxhp: c.maxhp ?? 100,
          status: c.status,
          fainted: c.fainted,
        };
        const side = sideOf(who.slot);
        const message =
          type === "drag"
            ? msg(`${name} was`, "dragged out!")
            : side === "opp"
              ? msg(`${player(opponent)} sent out`, `${name}!`)
              : msg(`Go! ${name}!`);
        if (type === "replace") beats.push({ hold: 0, switchIn: { side, battler } });
        else say(message, side === "opp" ? HOLD.oppSendOut : HOLD.mySendOut, { switchIn: { side, battler } });
        break;
      }

      case "move":
        if (who) say(msg(`${name} used`, `${up(args[2] ?? "")}!`));
        break;

      case "-damage":
      case "-heal":
      case "-sethp": {
        if (!who) break;
        const c = hpFor(who, args[2] ?? "");
        const hp = { side: sideOf(who.slot), name: who.name, hp: c.hp, maxhp: c.maxhp, status: c.status };
        const text = silent ? null : type === "-damage" ? damageText(name, from, tags.from, ofName) : type === "-heal" ? healText(name, from, tags, ofName) : sethpText(from);
        if (text) say(text, HOLD.message, { hp });
        else beats.push({ hold: HOLD.hp, hp });
        break;
      }

      case "-status": {
        if (!who || !isStatus(args[2])) break;
        const status = { side: sideOf(who.slot), name: who.name, status: args[2] };
        say(statusText(name, args[2]), HOLD.message, { status });
        break;
      }

      case "-curestatus": {
        // A side ident ("p1: Name") is a benched Pokémon (Heal Bell, Natural Cure): nothing on the field changes.
        if (!who || !/^p[12][a-z]:/.test(args[1] ?? "")) break;
        const status = { side: sideOf(who.slot), name: who.name, status: null };
        if (silent) beats.push({ hold: 0, status });
        else say(cureText(name, args[2]), HOLD.message, { status });
        break;
      }

      case "-cureteam":
        for (const side of ["me", "opp"] as const) {
          if (who && sideOf(who.slot) === side) beats.push({ hold: 0, status: { side, name: who.name, status: null } });
        }
        say(msg("The team's status", "was healed!"));
        break;

      case "faint":
        if (who) say(msg(`${name} fainted!`), HOLD.faint, { faint: { side: sideOf(who.slot), name: who.name } });
        break;

      case "-ability": {
        if (!who) break;
        const ability = args[2] ?? "";
        if (from.kind === "ability" && from.name === "Trace") {
          box(who, "Trace");
          say(msg(`${name} traced`, `${ofName}'s ${ability}!`), HOLD.abilityText);
          break;
        }
        box(who, ability);
        const text = abilityText(name, ability, args[3], ctx);
        if (text) say(text, HOLD.abilityText);
        break;
      }

      case "-boost":
      case "-unboost": {
        if (!who) break;
        const stat = STAT_NAMES[args[2] ?? ""] ?? up(args[2] ?? "");
        const n = Number(args[3] ?? 1);
        if (type === "-unboost" && previous?.type === "-ability" && previous.args[2] === "Intimidate") {
          const source = parseIdent(previous.args[1]);
          say(msg(`${source ? up(source.name) : ""}'s Intimidate`, `cuts ${name}'s ${stat === "ATTACK" ? "Attack" : stat}!`), HOLD.abilityText);
          break;
        }
        say(boostText(name, stat, type === "-boost" ? n : -n));
        break;
      }

      case "-setboost":
        if (who && from.name === "Belly Drum") say(msg(`${name} cut its own HP`, "and maximized ATTACK!"));
        break;

      case "-clearallboost":
        say(msg("All stat changes", "were eliminated!"));
        break;

      case "-clearboost":
        if (who) say(msg(`${name}'s stat changes`, "were removed!"));
        break;

      case "-clearnegativeboost":
        if (who) say(msg(`${name}'s stats`, "returned to normal!"));
        break;

      case "-supereffective":
        say(msg("It's super", "effective!"));
        break;

      case "-resisted":
        say(msg("It's not very", "effective..."));
        break;

      case "-immune":
        if (who) say(msg("It doesn't affect", `${name}...`));
        break;

      case "-crit":
        say(msg("A critical hit!"));
        break;

      case "-miss": {
        if (who) say(msg(`${name}'s attack`, "missed!"));
        break;
      }

      case "-fail":
        say(msg("But it failed!"));
        break;

      case "-notarget":
        say(msg("But there was", "no target..."));
        break;

      case "-ohko":
        say(msg("It's a one-hit KO!"));
        break;

      case "-hitcount": {
        const n = Number(args[2] ?? 0);
        say(msg(`Hit ${n} time${n === 1 ? "" : "s"}!`));
        break;
      }

      case "cant":
        if (who) say(cantText(name, args[2] ?? "", args[3]));
        break;

      case "-weather": {
        const text = weatherText(args[1] ?? "", "upkeep" in tags);
        if (text) say(text);
        break;
      }

      case "-sidestart":
      case "-sideend": {
        const side = parseIdent(args[1]);
        if (!side) break;
        const condition = effect(args[2]).name;
        say(type === "-sidestart" ? sideStartText(condition, player(side.slot)) : msg(`${player(side.slot)}'s ${up(condition)}`, "wore off!"));
        break;
      }

      case "-fieldstart":
        say(fieldText(effect(args[1]).name, true, ofName));
        break;

      case "-fieldend":
        say(fieldText(effect(args[1]).name, false, ""));
        break;

      case "-start": {
        if (!who) break;
        const text = startText(name, effect(args[2]).name, args[3], from);
        if (text) say(text);
        break;
      }

      case "-end": {
        if (!who || silent) break;
        const text = endText(name, effect(args[2]).name);
        if (text) say(text);
        break;
      }

      case "-activate": {
        if (!who) break;
        const text = activateText(name, effect(args[2]), args[3], ofName);
        if (text) say(text);
        break;
      }

      case "-singleturn": {
        if (!who) break;
        const condition = effect(args[2]).name;
        if (condition === "Protect" || condition === "Detect") say(msg(`${name} protected`, "itself!"));
        else if (condition === "Endure") say(msg(`${name} braced`, "itself!"));
        break;
      }

      case "-prepare":
        if (who) say(args[2] === "Solar Beam" ? msg(`${name} took`, "in sunlight!") : msg(`${name} is charging`, `${up(args[2] ?? "")}!`));
        break;

      case "-mustrecharge":
        break;

      case "-item": {
        if (!who) break;
        const item = up(args[2] ?? "");
        if (from.name === "Frisk" && of) say(msg(`${ofName} frisked ${name}`, `and found its ${item}!`));
        else say(msg(`${name} obtained`, `${item}!`));
        break;
      }

      case "-enditem": {
        if (!who || silent) break;
        const item = up(args[2] ?? "");
        if ("eat" in tags) say(msg(`${name} ate its`, `${item}!`));
        else if (from.name === "Knock Off") say(msg(`${ofName} knocked off`, `${name}'s ${item}!`));
        else if (from.name === "stealeat") say(msg(`${ofName} stole and ate`, `${name}'s ${item}!`));
        else if (args[2] === "Focus Sash") say(msg(`${name} hung on using`, `its ${item}!`));
        else if (args[2] === "Air Balloon") say(msg(`${name}'s ${item}`, "popped!"));
        else say(msg(`${name}'s ${item}`, "was used up..."));
        break;
      }

      case "-transform": {
        const into = parseIdent(args[2]);
        if (who && into) say(msg(`${name} transformed`, `into ${up(into.name)}!`));
        break;
      }

      case "-message":
        say(wrapMessage(args[1] ?? ""));
        break;
    }
    previous = { type, args };
  }
  return beats;
}

function damageText(name: string, from: ReturnType<typeof effect>, raw: string | undefined, of: string): Message | null {
  if (!raw) return null;
  switch (from.kind === "item" || from.kind === "ability" ? `${from.kind}:${from.name}` : from.name) {
    case "psn":
    case "tox":
      return msg(`${name} is hurt`, "by poison!");
    case "brn":
      return msg(`${name} is hurt`, "by its burn!");
    case "Recoil":
    case "recoil":
      return msg(`${name} is damaged`, "by recoil!");
    case "Stealth Rock":
      return msg("Pointed stones", `dug into ${name}!`);
    case "Spikes":
      return msg(`${name} is hurt`, "by the spikes!");
    case "sandstorm":
      return msg(`${name} is buffeted`, "by the sandstorm!");
    case "hail":
      return msg(`${name} is pelted`, "by hail!");
    case "confusion":
      return msg("It hurt itself in", "its confusion!");
    case "Leech Seed":
      return msg(`${name}'s health is`, "sapped by LEECH SEED!");
    case "Curse":
      return msg(`${name} is afflicted`, "by the curse!");
    case "Nightmare":
      return msg(`${name} is locked`, "in a nightmare!");
    case "item:Life Orb":
      return msg(`${name} lost some`, "of its HP!");
    case "item:Rocky Helmet":
      return msg(`${name} was hurt by`, `${of}'s ROCKY HELMET!`);
    case "item:Black Sludge":
      return msg(`${name} is hurt`, "by BLACK SLUDGE!");
    case "item:Sticky Barb":
      return msg(`${name} is hurt`, "by STICKY BARB!");
    default:
      if (from.kind === "move") return msg(`${name} is hurt`, `by ${up(from.name)}!`);
      if (from.kind === "item") return msg(`${name} is hurt`, `by its ${up(from.name)}!`);
      return msg(`${name} was`, "hurt!");
  }
}

function healText(name: string, from: ReturnType<typeof effect>, tags: Record<string, string>, of: string): Message {
  if (from.kind === "item") {
    return HEAL_ITEMS.has(from.name)
      ? msg(`${name} restored a little`, `HP using its ${up(from.name)}!`)
      : msg(`${name} restored HP`, `using its ${up(from.name)}!`);
  }
  if (from.kind === "ability") return msg(`${name} restored`, "its HP!");
  if (from.name === "drain") return msg(`${of || name} had its`, "energy drained!");
  if (from.name === "Wish" || "wisher" in tags) return msg(`${name}'s wish`, "came true!");
  if (from.name === "Ingrain") return msg(`${name} absorbed`, "nutrients with its roots!");
  if (from.name === "Aqua Ring") return msg(`A veil of water`, `restored ${name}'s HP!`);
  return msg(`${name} regained`, "health!");
}

function sethpText(from: ReturnType<typeof effect>): Message | null {
  return from.name === "Pain Split" ? msg("The battlers shared", "their pain!") : null;
}

function statusText(name: string, status: Status): Message {
  switch (status) {
    case "psn":
      return msg(`${name} was`, "poisoned!");
    case "tox":
      return msg(`${name} was badly`, "poisoned!");
    case "brn":
      return msg(`${name} was`, "burned!");
    case "par":
      return msg(`${name} is paralyzed!`, "It may be unable to move!");
    case "slp":
      return msg(name, "fell asleep!");
    case "frz":
      return msg(`${name} was`, "frozen solid!");
  }
}

function cureText(name: string, status: string | undefined): Message {
  switch (status) {
    case "slp":
      return msg(name, "woke up!");
    case "frz":
      return msg(name, "thawed out!");
    case "par":
      return msg(`${name} was cured`, "of paralysis!");
    case "brn":
      return msg(`${name}'s burn`, "was healed!");
    default:
      return msg(`${name} was cured`, "of its poisoning!");
  }
}

function boostText(name: string, stat: string, n: number): Message {
  const word =
    n === 0 ? "won't go any further!" : n >= 3 ? "rose drastically!" : n === 2 ? "rose sharply!" : n === 1 ? "rose!" : n === -1 ? "fell!" : n === -2 ? "harshly fell!" : "severely fell!";
  return msg(`${name}'s ${stat}`, word);
}

function cantText(name: string, reason: string, move: string | undefined): Message {
  const r = effect(reason);
  switch (r.name) {
    case "slp":
      return msg(`${name} is`, "fast asleep.");
    case "frz":
      return msg(`${name} is`, "frozen solid!");
    case "par":
      return msg(`${name} is paralyzed!`, "It can't move!");
    case "flinch":
      return msg(name, "flinched!");
    case "recharge":
      return msg(`${name} must`, "recharge!");
    case "Disable":
      return msg(`${name}'s ${up(move ?? "move")}`, "is disabled!");
    case "Taunt":
      return msg(`${name} can't use`, `${up(move ?? "it")} after the taunt!`);
    case "Truant":
      return msg(`${name} is`, "loafing around!");
    case "Attract":
      return msg(`${name} is`, "immobilized by love!");
    default:
      return msg(`${name} can't`, "move!");
  }
}

function weatherText(weather: string, upkeep: boolean): Message | null {
  const table: Record<string, [Message, Message]> = {
    RainDance: [msg("It started", "to rain!"), msg("Rain continues", "to fall.")],
    SunnyDay: [msg("The sunlight", "turned harsh!"), msg("The sunlight", "is strong.")],
    Sandstorm: [msg("A sandstorm", "kicked up!"), msg("The sandstorm", "rages.")],
    Hail: [msg("It started", "to hail!"), msg("Hail continues", "to fall.")],
  };
  if (weather === "none") return msg("The weather", "cleared up.");
  const entry = table[weather];
  return entry ? entry[upkeep ? 1 : 0] : null;
}

function sideStartText(condition: string, player: string): Message {
  switch (condition) {
    case "Stealth Rock":
      return msg("Pointed stones float", `around ${player}'s team!`);
    case "Spikes":
      return msg("Spikes were scattered", `around ${player}'s team!`);
    case "Toxic Spikes":
      return msg("Poison spikes were", `scattered around ${player}'s team!`);
    case "Sticky Web":
      return msg("A sticky web spreads", `out under ${player}'s team!`);
    case "Reflect":
      return msg("REFLECT raised", `${player}'s team's Defense!`);
    case "Light Screen":
      return msg("LIGHT SCREEN raised", `${player}'s team's Sp. Def!`);
    case "Tailwind":
      return msg("The tailwind blew from", `behind ${player}'s team!`);
    default:
      return msg(`${up(condition)} protects`, `${player}'s team!`);
  }
}

function fieldText(condition: string, start: boolean, of: string): Message {
  if (condition === "Trick Room") {
    return start ? msg(`${of || "The battlers"} twisted`, "the dimensions!") : msg("The twisted dimensions", "returned to normal!");
  }
  if (condition === "Gravity") return start ? msg("Gravity", "intensified!") : msg("Gravity returned", "to normal!");
  return start ? msg(`${up(condition)}`, "took effect!") : msg(`${up(condition)}`, "wore off!");
}

function abilityText(name: string, ability: string, arg: string | undefined, ctx: ScriptContext): Message | null {
  switch (ability) {
    case "Pressure":
      return msg(`${name} is exerting`, "its Pressure!");
    case "Mold Breaker":
      return msg(`${name} breaks`, "the mold!");
    case "Unnerve": {
      const side = parseIdent(arg);
      return msg(`${side ? ctx.names[side.slot] : "The"}'s team is too`, "nervous to eat Berries!");
    }
    case "Air Lock":
    case "Cloud Nine":
      return msg("The effects of the", "weather disappeared.");
    default:
      return null;
  }
}

function startText(name: string, condition: string, arg: string | undefined, from: ReturnType<typeof effect>): Message | null {
  switch (condition) {
    case "confusion":
      return msg(`${name} became`, "confused!");
    case "Substitute":
      return msg(`${name} put in`, "a substitute!");
    case "Leech Seed":
      return msg(`${name} was`, "seeded!");
    case "Taunt":
      return msg(`${name} fell for`, "the taunt!");
    case "Encore":
      return msg(`${name} received`, "an encore!");
    case "Disable":
      return msg(`${name}'s ${up(arg ?? "move")}`, "was disabled!");
    case "Yawn":
      return msg(`${name} grew`, "drowsy!");
    case "Attract":
      return msg(`${name} fell`, "in love!");
    case "Focus Energy":
      return msg(`${name} is getting`, "pumped!");
    case "Curse":
      return msg(`${name} laid a curse!`);
    case "Magnet Rise":
      return msg(`${name} levitated with`, "electromagnetism!");
    case "Aqua Ring":
      return msg(`${name} surrounded itself`, "with a veil of water!");
    case "Ingrain":
      return msg(`${name} planted`, "its roots!");
    case "Flash Fire":
      return msg(`The power of ${name}'s`, "Fire-type moves rose!");
    case "perish3":
    case "perish2":
    case "perish1":
    case "perish0":
      return msg(`${name}'s perish count`, `fell to ${condition.slice(-1)}.`);
    case "typechange":
      return from.kind === "ability" ? msg(`${name} became`, `the ${up(arg ?? "")} type!`) : null;
    default:
      return null;
  }
}

function endText(name: string, condition: string): Message | null {
  switch (condition) {
    case "Substitute":
      return msg(`${name}'s substitute`, "faded!");
    case "confusion":
      return msg(`${name} snapped out`, "of its confusion!");
    case "Leech Seed":
      return msg(`${name} was freed`, "from LEECH SEED!");
    case "Taunt":
      return msg(`${name}'s taunt`, "wore off!");
    case "Encore":
      return msg(`${name}'s encore`, "ended!");
    case "Disable":
      return msg(`${name}'s move is`, "no longer disabled!");
    default:
      return null;
  }
}

function activateText(name: string, e: ReturnType<typeof effect>, arg: string | undefined, of: string): Message | null {
  switch (e.name) {
    case "Protect":
    case "Detect":
      return msg(`${name} protected`, "itself!");
    case "confusion":
      return msg(`${name} is`, "confused!");
    case "Substitute":
      return msg("The substitute took", `damage for ${name}!`);
    case "Destiny Bond":
      return msg(`${name} took its attacker`, "down with it!");
    case "Sturdy":
    case "Endure":
      return msg(`${name} endured`, "the hit!");
    case "trapped":
      return msg(`${name} can no longer`, "escape!");
    case "Attract":
      return msg(`${name} is in love`, `with ${of || "the foe"}!`);
    case "Struggle":
      return msg(`${name} has no`, "moves left!");
    case "Spite":
      return msg(`It reduced the PP`, `of ${name}'s ${up(arg ?? "move")}!`);
    case "Heal Bell":
      return msg("A bell chimed!");
    case "Aromatherapy":
      return msg("A soothing aroma", "wafted through the area!");
    default:
      return null;
  }
}

/** The scene after one beat. The ability box only lasts its own beat. */
export function applyBeat(scene: Scene, beat: Beat): Scene {
  const active = { ...scene.active };
  const entrances = { ...scene.entrances };
  let intro = beat.intro ?? scene.intro;
  if (beat.switchIn) {
    active[beat.switchIn.side] = beat.switchIn.battler;
    entrances[beat.switchIn.side] += 1;
    intro = false;
  }
  if (beat.hp) {
    const mon = active[beat.hp.side];
    if (mon && mon.name === beat.hp.name) {
      active[beat.hp.side] = {
        ...mon,
        hp: beat.hp.hp,
        maxhp: beat.hp.maxhp ?? mon.maxhp,
        fainted: beat.hp.hp === 0 ? mon.fainted : false,
        status: beat.hp.status !== undefined && beat.hp.status !== null ? beat.hp.status : mon.status,
      };
    }
  }
  if (beat.status) {
    const mon = active[beat.status.side];
    if (mon && mon.name === beat.status.name) active[beat.status.side] = { ...mon, status: beat.status.status };
  }
  if (beat.faint) {
    const mon = active[beat.faint.side];
    if (mon && mon.name === beat.faint.name) active[beat.faint.side] = { ...mon, hp: 0, fainted: true, status: null };
  }
  return {
    intro,
    active,
    entrances,
    message: beat.message ?? scene.message,
    ability: beat.ability ?? null,
  };
}

/** The scene after all `beats` at once (rebuilding after a refresh): no ability box, an empty message. */
export function replay(scene: Scene, beats: readonly Beat[]): Scene {
  return { ...beats.reduce(applyBeat, scene), ability: null, message: EMPTY };
}
