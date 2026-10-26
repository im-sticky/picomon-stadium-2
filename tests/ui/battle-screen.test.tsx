import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BattleScreen } from "@/app/room/[code]/battle-screen";
import type { BattleView } from "@/lib/battle-types";
import type { RoomState } from "@/lib/types";

const state: RoomState = {
  code: "K7PQ",
  game: 1,
  you: { id: "a", slot: 1 },
  players: [
    { id: "a", name: "Gold", trainer: "gold", slot: 1 },
    { id: "b", name: "Silver", trainer: "silver", slot: 2 },
  ],
  phase: "battle",
  battleSize: 3,
  draftType: "standard",
  lobby: null,
  typeBattle: null,
  draft: null,
  battle: { stage: "in-progress", result: null },
};

const INTRO = [
  "|",
  "|teamsize|p1|3",
  "|teamsize|p2|3",
  "|start",
  "|switch|p1a: Gyarados|Gyarados, L50, F|171/171",
  "|switch|p2a: Arcanine|Arcanine, L50, F|165/165",
  "|turn|1",
];

// Your Gyarados faints and Gengar comes in, then SILVER's last Pokémon faints.
const view: BattleView = {
  code: "K7PQ",
  you: { slot: 1 },
  battleSize: 3,
  stage: "ended",
  step: 3,
  asked: { 1: null, 2: null },
  chosen: false,
  request: null,
  order: null,
  deadline: Date.now() + 80_000,
  serverNow: Date.now(),
  timeouts: { 1: 0, 2: 0 },
  log: {
    from: 1,
    steps: [
      INTRO,
      ["|", "|-damage|p1a: Gyarados|0/171 fnt", "|faint|p1a: Gyarados", "|switch|p1a: Gengar|Gengar, L50, M|136/136", "|turn|2"],
      ["|", "|-damage|p2a: Arcanine|0 fnt", "|faint|p2a: Arcanine", "|win|GOLD"],
    ],
  },
  result: { winner: 1, reason: "normal" },
  rematch: null,
};

const renderScreen = () =>
  render(
    <BattleScreen
      state={state}
      pool={[]}
      subscribeBattle={() => () => {}}
      onAction={async () => true}
      onRoomChanged={() => {}}
      onClosed={() => {}}
    />,
  );

const places = (row: HTMLElement) => Array.from(row.children);
const darkened = (row: HTMLElement) => places(row).filter((el) => /battle__ball--out/.test(el.getAttribute("class") ?? ""));

afterEach(() => vi.unstubAllGlobals());

describe("BattleScreen ball rows", () => {
  it("has 6 places at the intro, the ones past the battle size empty", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderScreen();
    for (const label of ["Your team: 3 of 3 left", "SILVER's team: 3 of 3 left"]) {
      const row = screen.getByRole("img", { name: label });
      expect(places(row)).toHaveLength(6);
      expect(row.querySelectorAll("img")).toHaveLength(3);
      const empty = row.querySelectorAll("svg");
      expect(empty).toHaveLength(3);
      expect(empty[0]).toHaveAttribute("aria-hidden", "true");
      expect(empty[0]).toHaveAttribute("viewBox", "0 0 16 16");
    }
    expect(screen.getByRole("img", { name: "SILVER" })).toBeInTheDocument();
  });
});

describe("BattleScreen end screen", () => {
  it("shows the trainer and both ball rows, fainted first and darkened, with no Pokémon", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(view), { status: 200 })));
    renderScreen();
    expect(await screen.findByRole("button", { name: "REMATCH" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QUIT" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("GOLD wonthe battle!");

    // SILVER's trainer, as at the intro.
    expect(screen.getByRole("img", { name: "SILVER" })).toBeInTheDocument();

    const mine = screen.getByRole("img", { name: "Your team: 2 of 3 left" });
    expect(places(mine)).toHaveLength(6);
    expect(darkened(mine)).toEqual([places(mine)[0]]);
    const theirs = screen.getByRole("img", { name: "SILVER's team: 2 of 3 left" });
    expect(darkened(theirs)).toEqual([places(theirs)[0]]);
    // At their intro positions, not sliding.
    expect(theirs.className).not.toMatch(/battle__balls--(in|leave)/);

    // No sprites and no info boxes.
    expect(screen.queryByRole("img", { name: "GENGAR" })).toBeNull();
    expect(screen.queryByRole("img", { name: "ARCANINE" })).toBeNull();
    expect(screen.queryByRole("region", { name: "GENGAR" })).toBeNull();
    expect(within(document.body).queryByText("136/136")).toBeNull();
  });
});
