import { describe, expect, it } from "vitest";
import { applyBeat, HOLD, initialScene, replay, stepBeats, wrapMessage, type ScriptContext } from "@/lib/battle-script";

// Lines as the engine writes them (lib/battle-engine's linesFor), from a 3v3 with a
// fixed seed: Gyarados (P1) against Arcanine (P2), both with Intimidate.
const INTRO_P1 = [
  "|",
  "|teamsize|p1|3",
  "|teamsize|p2|3",
  "|start",
  "|switch|p1a: Gyarados|Gyarados, L50, F|171/171",
  "|switch|p2a: Arcanine|Arcanine, L50, F|100/100",
  "|-ability|p2a: Arcanine|Intimidate|boost",
  "|-unboost|p1a: Gyarados|atk|1",
  "|-ability|p1a: Gyarados|Intimidate|boost",
  "|-unboost|p2a: Arcanine|atk|1",
  "|turn|1",
];
const INTRO_P2 = INTRO_P1.map((l) => l.replace("171/171", "100/100")).map((l) =>
  l === "|switch|p2a: Arcanine|Arcanine, L50, F|100/100" ? "|switch|p2a: Arcanine|Arcanine, L50, F|165/165" : l,
);
const TURN_P1 = [
  "|",
  "|move|p2a: Arcanine|Flare Blitz|p1a: Gyarados",
  "|-resisted|p1a: Gyarados",
  "|-damage|p1a: Gyarados|127/171",
  "|-damage|p2a: Arcanine|91/100|[from] Recoil",
  "|move|p1a: Gyarados|Waterfall|p2a: Arcanine",
  "|-supereffective|p2a: Arcanine",
  "|-damage|p2a: Arcanine|22/100",
  "|",
  "|-heal|p2a: Arcanine|28/100|[from] item: Leftovers",
  "|upkeep",
  "|turn|2",
];

const host: ScriptContext = { you: 1, names: { 1: "GOLD", 2: "SILVER" }, exact: true };
const guest: ScriptContext = { ...host, you: 2 };
const messages = (lines: string[], ctx: ScriptContext) => stepBeats(lines, ctx).flatMap((b) => (b.message ? [b.message] : []));
const play = (lines: string[], ctx: ScriptContext, scene = initialScene()) => replay(scene, stepBeats(lines, ctx));

describe("stepBeats: the intro", () => {
  it("says who wants to battle, sends the opponent out first, then yours, then the abilities", () => {
    expect(messages(INTRO_P1, host)).toEqual([
      ["SILVER wants", "to battle!"],
      ["SILVER sent out", "ARCANINE!"],
      ["Go! GYARADOS!", ""],
      ["ARCANINE's Intimidate", "cuts GYARADOS's Attack!"],
      ["GYARADOS's Intimidate", "cuts ARCANINE's Attack!"],
    ]);
    // The guest's own Pokémon is P2's: the host's goes out first for them.
    expect(messages(INTRO_P2, guest).slice(0, 3)).toEqual([
      ["GOLD wants", "to battle!"],
      ["GOLD sent out", "GYARADOS!"],
      ["Go! ARCANINE!", ""],
    ]);
  });

  it("shows each ability box on its own beat, from that Pokémon's side, before the message", () => {
    const beats = stepBeats(INTRO_P1, host);
    const boxes = beats.filter((b) => b.ability);
    expect(boxes.map((b) => [b.ability, b.hold])).toEqual([
      [{ side: "opp", name: "ARCANINE", ability: "Intimidate" }, HOLD.ability],
      [{ side: "me", name: "GYARADOS", ability: "Intimidate" }, HOLD.ability],
    ]);
    const first = beats.indexOf(boxes[0]);
    expect(beats[first + 1].message).toEqual(["ARCANINE's Intimidate", "cuts GYARADOS's Attack!"]);
    // The box only lasts its own beat.
    const scene = beats.slice(0, first + 2).reduce(applyBeat, initialScene());
    expect(scene.ability).toBeNull();
    expect(beats.slice(0, first + 1).reduce(applyBeat, initialScene()).ability).toEqual(boxes[0].ability);
  });

  it("keeps the trainer up until the first send-out, and counts each entrance", () => {
    const beats = stepBeats(INTRO_P1, host);
    expect(applyBeat(initialScene(), beats[0])).toMatchObject({ intro: true, message: ["SILVER wants", "to battle!"] });
    const afterOpp = beats.slice(0, 2).reduce(applyBeat, initialScene());
    expect(afterOpp).toMatchObject({ intro: false, entrances: { opp: 1, me: 0 }, active: { me: null } });
    expect(play(INTRO_P1, host)).toMatchObject({
      intro: false,
      entrances: { opp: 1, me: 1 },
      message: ["", ""],
      ability: null,
      active: {
        me: { name: "Gyarados", pokemonId: "gyarados", hp: 171, maxhp: 171, status: null, fainted: false },
        opp: { name: "Arcanine", pokemonId: "arcanine", hp: 100, maxhp: 100 },
      },
    });
  });
});

describe("stepBeats: a turn", () => {
  it("turns moves, effectiveness, damage, recoil and items into messages in order", () => {
    expect(messages(TURN_P1, host)).toEqual([
      ["ARCANINE used", "FLARE BLITZ!"],
      ["It's not very", "effective..."],
      ["ARCANINE is damaged", "by recoil!"],
      ["GYARADOS used", "WATERFALL!"],
      ["It's super", "effective!"],
      ["ARCANINE restored a little", "HP using its LEFTOVERS!"],
    ]);
  });

  it("moves each HP bar to the new value: yours exact, the opponent's out of 100", () => {
    const hp = stepBeats(TURN_P1, host).flatMap((b) => (b.hp ? [b.hp] : []));
    expect(hp).toEqual([
      { side: "me", name: "Gyarados", hp: 127, maxhp: 171, status: null },
      { side: "opp", name: "Arcanine", hp: 91, maxhp: 100, status: null },
      { side: "opp", name: "Arcanine", hp: 22, maxhp: 100, status: null },
      { side: "opp", name: "Arcanine", hp: 28, maxhp: 100, status: null },
    ]);
    // A plain hit has no message of its own: the bar moves under "used X!".
    const plain = stepBeats(TURN_P1, host).find((b) => b.hp?.hp === 127)!;
    expect(plain).toEqual({ hold: HOLD.hp, hp: expect.anything() });
    const scene = play(TURN_P1, host, play(INTRO_P1, host));
    expect(scene.active.me).toMatchObject({ hp: 127, maxhp: 171 });
    expect(scene.active.opp).toMatchObject({ hp: 28, maxhp: 100 });
  });

  it("never treats the opponent's HP as exact, even from public lines", () => {
    const publicLines = TURN_P1.map((l) => l.replace("127/171", "74/100"));
    for (const ctx of [host, { ...host, exact: false, maxHpOf: () => 171 }]) {
      for (const beat of stepBeats(publicLines, ctx)) {
        if (beat.hp?.side === "opp") expect(beat.hp.maxhp).toBe(100);
      }
    }
  });

  it("turns your public HP (out of 100) back into numbers from your max HP", () => {
    const publicLines = TURN_P1.map((l) => l.replace("127/171", "74/100"));
    const ctx: ScriptContext = { ...host, exact: false, maxHpOf: (name) => (name === "Gyarados" ? 171 : undefined) };
    const mine = stepBeats(publicLines, ctx).find((b) => b.hp?.side === "me")!;
    expect(mine.hp).toMatchObject({ hp: 127, maxhp: 171 });
  });
});

describe("stepBeats: status, faints and switches", () => {
  const field = play(INTRO_P1, host);

  it("sets and cures a status on the field, with its message", () => {
    const poisoned = stepBeats(["|-status|p2a: Arcanine|psn"], host);
    expect(poisoned.map((b) => b.message)).toEqual([["ARCANINE was", "poisoned!"]]);
    expect(play(["|-status|p2a: Arcanine|psn"], host, field).active.opp?.status).toBe("psn");
    const asleep = play(["|-status|p1a: Gyarados|slp"], host, field);
    expect(play(["|-curestatus|p1a: Gyarados|slp|[msg]"], host, asleep).active.me?.status).toBeNull();
    expect(messages(["|-curestatus|p1a: Gyarados|slp|[msg]"], host)).toEqual([["GYARADOS", "woke up!"]]);
    // A benched Pokémon's cure (a side ident) changes nothing on the field.
    expect(stepBeats(["|-curestatus|p1: Gengar|par|[msg]"], host)).toEqual([]);
  });

  it("faints, then sends a replacement out", () => {
    const fainted = play(["|-damage|p2a: Arcanine|0 fnt", "|faint|p2a: Arcanine"], host, field);
    expect(fainted.active.opp).toMatchObject({ hp: 0, fainted: true });
    expect(messages(["|faint|p2a: Arcanine"], host)).toEqual([["ARCANINE fainted!", ""]]);
    const next = play(["|switch|p2a: Blissey|Blissey, L50, F|100/100", "|turn|3"], host, fainted);
    expect(next.active.opp).toMatchObject({ name: "Blissey", hp: 100, fainted: false });
    expect(next.entrances.opp).toBe(2);
    expect(messages(["|switch|p2a: Blissey|Blissey, L50, F|100/100"], host)).toEqual([["SILVER sent out", "BLISSEY!"]]);
    expect(messages(["|switch|p1a: Gengar|Gengar, L50, M|136/136 par"], host)).toEqual([["Go! GENGAR!", ""]]);
    expect(play(["|switch|p1a: Gengar|Gengar, L50, M|136/136 par"], host, field).active.me).toMatchObject({
      name: "Gengar",
      hp: 136,
      maxhp: 136,
      status: "par",
    });
  });

  it("shows an ability from a [from] tag on its owner's side", () => {
    const beats = stepBeats(["|-weather|RainDance|[from] ability: Drizzle|[of] p2a: Politoed"], host);
    expect(beats).toEqual([
      { hold: HOLD.ability, ability: { side: "opp", name: "POLITOED", ability: "Drizzle" } },
      { hold: HOLD.message, message: ["It started", "to rain!"] },
    ]);
    const healed = stepBeats(["|-heal|p1a: Gyarados|171/171|[from] ability: Water Absorb|[of] p2a: Arcanine"], host);
    expect(healed[0].ability).toEqual({ side: "me", name: "GYARADOS", ability: "Water Absorb" });
  });

  it("says nothing for the end lines: the result decides the end message", () => {
    expect(stepBeats(["|win|P1", "|tie", "|upkeep", "|"], host)).toEqual([]);
  });

  it("explains a move that can't be used", () => {
    expect(messages(["|cant|p1a: Gyarados|par"], host)).toEqual([["GYARADOS is paralyzed!", "It can't move!"]]);
    expect(messages(["|cant|p2a: Arcanine|flinch"], host)).toEqual([["ARCANINE", "flinched!"]]);
  });
});

describe("wrapMessage", () => {
  it("keeps short text on one line and splits long text at a space", () => {
    expect(wrapMessage("Sleep Clause Mod activated.")).toEqual(["Sleep Clause Mod activated.", ""]);
    const [a, b] = wrapMessage("This is a much longer sentence that needs the second line too.");
    expect(a.length).toBeLessThanOrEqual(40);
    expect(`${a} ${b}`).toBe("This is a much longer sentence that needs the second line too.");
  });
});
