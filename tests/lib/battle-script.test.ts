import { describe, expect, it } from "vitest";
import {
  applyBeat,
  HOLD,
  initialScene,
  replay,
  stepBeats,
  wrapMessage,
  type Beat,
  type Scene,
  type ScriptContext,
} from "@/lib/battle-script";

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

  it("copies the target's species on Transform or Imposter, until it switches out", () => {
    const ditto = play(["|switch|p2a: Ditto|Ditto, L50|100/100"], host, field);
    const transformed = play(["|-transform|p2a: Ditto|p1a: Gyarados|[from] ability: Imposter"], host, ditto);
    expect(transformed.active.opp).toMatchObject({ name: "Ditto", pokemonId: "ditto", transformedInto: "gyarados" });
    expect(messages(["|-transform|p2a: Ditto|p1a: Gyarados"], host)).toEqual([["DITTO transformed", "into GYARADOS!"]]);
    const back = play(["|switch|p2a: Ditto|Ditto, L50|100/100"], host, transformed);
    expect(back.active.opp?.transformedInto).toBeUndefined();
  });

  it("shows an ability from a [from] tag on its owner's side", () => {
    const beats = stepBeats(["|-weather|RainDance|[from] ability: Drizzle|[of] p2a: Politoed"], host);
    expect(beats).toEqual([
      { hold: HOLD.ability, ability: { side: "opp", name: "POLITOED", ability: "Drizzle" } },
      { hold: HOLD.message, message: ["It started", "to rain!"], weather: "rain" },
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

describe("stepBeats: the opponent's ball row", () => {
  // As the battle screen calls it: with who is on the field when the step starts.
  const beatsAt = (lines: string[], scene: Scene, ctx = host) => stepBeats(lines, { ...ctx, field: scene.active });
  const at = (lines: string[], scene: Scene, ctx = host) => replay(scene, beatsAt(lines, scene, ctx));
  const field = play(INTRO_P1, host);
  const FAINT = ["|move|p1a: Gyarados|Waterfall|p2a: Arcanine", "|-damage|p2a: Arcanine|0 fnt", "|faint|p2a: Arcanine", "|upkeep"];
  const REPLACE = ["|", "|switch|p2a: Blissey|Blissey, L50, F|100/100", "|turn|3"];
  const rowOf = (beats: Beat[]) => beats.flatMap((b) => (b.oppBalls ? [b.oppBalls] : []));

  it("slides in after the opponent's faint and stays up for the replacement", () => {
    const beats = beatsAt(FAINT, field);
    const faint = beats.findIndex((b) => b.faint);
    expect(beats[faint]).toMatchObject({ hold: HOLD.oppFaint, message: ["ARCANINE fainted!", ""] });
    expect(beats[faint + 1]).toEqual({ hold: HOLD.ballsIn, oppBalls: "in" });
    const fainted = at(FAINT, field);
    expect(fainted).toMatchObject({ oppBalls: "in", oppFainted: 1, active: { opp: { fainted: true } } });

    // The next step: the send-out with the row up, then it slides out.
    const next = beatsAt(REPLACE, fainted);
    expect(next.map((b) => [b.message, b.oppBalls, b.hold])).toEqual([
      [["SILVER sent out", "BLISSEY!"], undefined, HOLD.ballsSendOut],
      [undefined, "leave", HOLD.ballsOut],
      [undefined, "off", HOLD.ballsGone],
    ]);
    const sentOut = next.slice(0, 1).reduce(applyBeat, fainted);
    expect(sentOut).toMatchObject({ oppBalls: "in", active: { opp: { name: "Blissey" } } });
    expect(at(REPLACE, fainted)).toMatchObject({ oppBalls: null, oppFainted: 1, active: { opp: { name: "Blissey", fainted: false } } });
  });

  it("stays up when the opponent has no Pokémon left", () => {
    const end = at([...FAINT, "|win|GOLD"], field);
    expect(end).toMatchObject({ oppBalls: "in", oppFainted: 1 });
  });

  it("withdraws on a voluntary switch, then slides in, sends out and slides out", () => {
    const beats = beatsAt(["|", "|switch|p2a: Blissey|Blissey, L50, F|100/100", "|turn|2"], field);
    expect(beats.map((b) => [b.message, b.oppBalls, b.hold])).toEqual([
      [["SILVER withdrew", "ARCANINE!"], undefined, HOLD.withdraw],
      [undefined, "in", HOLD.ballsIn],
      [["SILVER sent out", "BLISSEY!"], undefined, HOLD.ballsSendOut],
      [undefined, "leave", HOLD.ballsOut],
      [undefined, "off", HOLD.ballsGone],
    ]);
    // The withdraw takes the sprite and info off the field; nobody fainted.
    expect(applyBeat(field, beats[0]).active.opp).toBeNull();
    expect(beats.reduce(applyBeat, field)).toMatchObject({ oppBalls: null, oppFainted: 0, active: { opp: { name: "Blissey" } } });
  });

  it("tells a U-turn switch from a faint in the same step", () => {
    const lines = ["|move|p2a: Arcanine|U-turn|p1a: Gyarados", "|-damage|p1a: Gyarados|100/171", "|switch|p2a: Blissey|Blissey, L50, F|100/100|[from] U-turn"];
    expect(messages(lines, { ...host, field: field.active })).toContainEqual(["SILVER withdrew", "ARCANINE!"]);
    // A faint earlier in the same step makes the switch a replacement.
    const both = beatsAt(["|faint|p2a: Arcanine", "|switch|p2a: Blissey|Blissey, L50, F|100/100"], field);
    expect(both.flatMap((b) => (b.message ? [b.message] : []))).toEqual([
      ["ARCANINE fainted!", ""],
      ["SILVER sent out", "BLISSEY!"],
    ]);
    expect(rowOf(both)).toEqual(["in", "leave", "off"]);
  });

  it("shows no row for your own switches and faints, the intro, or a drag", () => {
    expect(rowOf(stepBeats(INTRO_P1, { ...host, field: initialScene().active }))).toEqual([]);
    expect(rowOf(beatsAt(["|switch|p1a: Gengar|Gengar, L50, M|136/136"], field))).toEqual([]);
    expect(rowOf(beatsAt(["|faint|p1a: Gyarados"], field))).toEqual([]);
    const dragged = beatsAt(["|drag|p2a: Blissey|Blissey, L50, F|100/100"], field);
    expect(rowOf(dragged)).toEqual([]);
    expect(dragged.map((b) => b.message)).toEqual([["BLISSEY was", "dragged out!"]]);
  });

  it("is seen the same way from the guest's side", () => {
    const guestField = play(INTRO_P2, guest);
    const beats = beatsAt(["|switch|p1a: Gengar|Gengar, L50, M|100/100"], guestField, guest);
    expect(beats[0].message).toEqual(["GOLD withdrew", "GYARADOS!"]);
    expect(rowOf(beats)).toEqual(["in", "leave", "off"]);
  });

  it("counts each of the opponent's faints once, across steps", () => {
    let scene = at(FAINT, field);
    scene = at(REPLACE, scene);
    scene = at(["|faint|p2a: Blissey"], scene);
    expect(scene).toMatchObject({ oppFainted: 2, oppBalls: "in" });
    // A repeated faint line for the same Pokémon doesn't count twice.
    expect(at(["|faint|p2a: Blissey"], scene).oppFainted).toBe(2);
  });
});

describe("stepBeats: weather", () => {
  const RAIN = ["|move|p1a: Gyarados|Rain Dance|p1a: Gyarados", "|-weather|RainDance"];
  const UPKEEP = ["|", "|-weather|RainDance|[upkeep]", "|upkeep", "|turn|3"];
  const CLEAR = ["|", "|-weather|none", "|upkeep", "|turn|4"];

  it("starts clear", () => {
    expect(initialScene().weather).toBeNull();
  });

  it("sets the weather on a -weather line, with its message", () => {
    const beats = stepBeats(RAIN, host);
    const beat = beats.find((b) => b.weather);
    expect(beat).toMatchObject({ weather: "rain", message: ["It started", "to rain!"] });
    expect(beats.reduce(applyBeat, initialScene()).weather).toBe("rain");
  });

  it("maps each weather id", () => {
    for (const [id, weather] of [["RainDance", "rain"], ["SunnyDay", "sun"], ["Sandstorm", "sandstorm"], ["Hail", "hail"]]) {
      expect(play([`|-weather|${id}|[from] ability: Drought|[of] p2a: Arcanine`], host).weather).toBe(weather);
    }
  });

  it("keeps the weather on upkeep", () => {
    const rain = play(RAIN, host);
    const beats = stepBeats(UPKEEP, host);
    expect(beats.map((b) => b.message)).toContainEqual(["Rain continues", "to fall."]);
    expect(beats.reduce(applyBeat, rain).weather).toBe("rain");
    // A step with no weather line leaves it alone too.
    expect(play(["|", "|upkeep", "|turn|3"], host, rain).weather).toBe("rain");
  });

  it("clears on none", () => {
    const beats = stepBeats(CLEAR, host);
    expect(beats.find((b) => b.weather)).toMatchObject({ weather: "none", message: ["The weather", "cleared up."] });
    expect(play(CLEAR, host, play(RAIN, host)).weather).toBeNull();
  });

  it("is restored by replay after a refresh", () => {
    const beats = [...stepBeats(RAIN, host), ...stepBeats(UPKEEP, host)];
    expect(replay(initialScene(), beats)).toMatchObject({ weather: "rain", message: ["", ""], ability: null });
    expect(replay(initialScene(), [...beats, ...stepBeats(CLEAR, host)]).weather).toBeNull();
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
