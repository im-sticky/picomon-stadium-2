import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomScreen } from "@/app/room/[code]/room-screen";
import type { RoomAction } from "@/app/room/[code]/room-view";
import type { LobbyView, RoomState, Slot } from "@/lib/types";

const host = { id: "a", name: "Ash", trainer: null, slot: 1 as const };
const guest = { id: "b", name: "Misty", trainer: null, slot: 2 as const };

const onAction = vi.fn<RoomAction>(async () => true);

/** The waiting room as player `you`, with these players and lobby fields. */
function room(you: Slot, players = [host, guest], lobby: Partial<LobbyView> = {}, more: Partial<RoomState> = {}): RoomState {
  return {
    code: "K7PQ",
    you: { id: you === 1 ? "a" : "b", slot: you },
    players,
    phase: "lobby",
    game: 1,
    battleSize: 6,
    draftType: "standard",
    lobby: { version: 0, ready: { 1: false, 2: false }, startAt: null, optionsChanged: false, serverNow: 0, ...lobby },
    typeBattle: null,
    draft: null,
    battle: null,
    ...more,
  };
}

function messageLines(role: "status" | "alert" = "status") {
  return [...screen.getByRole(role).querySelectorAll("p")].map((p) => p.textContent);
}

function playerRows() {
  const list = within(screen.getByRole("region", { name: "Players" })).getByRole("list");
  return within(list).getAllByRole("listitem").map((li) => li.textContent);
}

const radioNames = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("radio")
    .map((r) => r.closest("label")!.textContent);

beforeEach(() => {
  onAction.mockReset();
  onAction.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

describe("RoomScreen", () => {
  it("host alone sees the waiting view with code K7PQ, no COPY, READY disabled", () => {
    render(<RoomScreen state={room(1, [host])} onAction={onAction} />);
    expect(screen.getByRole("heading", { name: "WAITING ROOM" })).toBeInTheDocument();
    const codeBox = screen.getByRole("region", { name: "Room code" });
    expect(within(codeBox).getByText("ROOM CODE")).toBeInTheDocument();
    expect(within(codeBox).getByText("K7PQ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /COPY/ })).toBeNull();
    expect(playerRows()).toEqual(["P1AshHOST", "P2- - - - - -Waiting"]);
    expect(messageLines()).toEqual(["Send this code to a friend.", "Waiting for an opponent..."]);
    expect(screen.getByRole("button", { name: "READY" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "DRAFT RULES" })).toHaveAttribute("href", "/room/K7PQ/rules");
  });

  it("guest alone also sees the waiting view", () => {
    render(<RoomScreen state={room(2, [guest])} onAction={onAction} />);
    expect(screen.getByRole("heading", { name: "WAITING ROOM" })).toBeInTheDocument();
    expect(screen.queryByText("Both players connected!")).toBeNull();
  });

  it("two players: title, both names, host marked HOST, READY enabled, DRAFT RULES", () => {
    render(<RoomScreen state={room(1)} onAction={onAction} />);
    expect(screen.getByRole("heading", { name: "ROOM K7PQ" })).toBeInTheDocument();
    expect(playerRows()).toEqual(["P1AshHOST", "P2Misty"]);
    expect(messageLines()).toEqual(["Both players connected!", "Ready to battle?"]);
    expect(screen.getByRole("button", { name: "READY" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "DRAFT RULES" })).toHaveAttribute("href", "/room/K7PQ/rules");
  });

  it("the guest shares the messages and READY", () => {
    render(<RoomScreen state={room(2)} onAction={onAction} />);
    expect(messageLines()).toEqual(["Both players connected!", "Ready to battle?"]);
    expect(screen.getByRole("button", { name: "READY" })).toBeEnabled();
  });

  describe("options", () => {
    it("the host sees BATTLE TYPE and DRAFT TYPE radios, largest first, with the room's checked", () => {
      render(<RoomScreen state={room(1, [host], {}, { battleSize: 4, draftType: "pokeball" })} onAction={onAction} />);
      expect(radioNames("BATTLE TYPE")).toEqual(["6V6", "4V4", "3V3"]);
      expect(radioNames("DRAFT TYPE")).toEqual(["Standard", "Unlimited", "Poké Ball"]);
      expect(screen.getByRole("radio", { name: "4V4" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Poké Ball" })).toBeChecked();
    });

    it("picking one sends both options and shows it at once", async () => {
      let resolve!: (ok: boolean) => void;
      onAction.mockImplementationOnce(() => new Promise<boolean>((r) => (resolve = r)));
      render(<RoomScreen state={room(1)} onAction={onAction} />);
      await userEvent.click(screen.getByRole("radio", { name: "4V4" }));
      expect(onAction).toHaveBeenCalledWith("options", { battleSize: 4, draftType: "standard" });
      expect(screen.getByRole("radio", { name: "4V4" })).toBeChecked();
      await act(async () => resolve(true));
    });

    it("a failed change goes back to the room's options and says so", async () => {
      onAction.mockResolvedValueOnce(false);
      render(<RoomScreen state={room(1)} onAction={onAction} />);
      await userEvent.click(screen.getByRole("radio", { name: "Unlimited" }));
      expect(onAction).toHaveBeenCalledWith("options", { battleSize: 6, draftType: "unlimited" });
      expect(screen.getByRole("radio", { name: "Standard" })).toBeChecked();
      expect(messageLines("alert")).toEqual(["Something went wrong.", "Try again."]);
    });

    it("the guest sees them as text, not radios", () => {
      render(<RoomScreen state={room(2)} onAction={onAction} />);
      expect(screen.queryAllByRole("radio")).toEqual([]);
      const options = screen.getByLabelText("Battle size and draft type");
      expect(within(options).getByText("6V6")).toBeInTheDocument();
      expect(within(options).getByText("Standard Draft")).toBeInTheDocument();
    });
  });

  describe("READY", () => {
    it("READY readies you; then CANCEL READY un-readies you", async () => {
      const { rerender } = render(<RoomScreen state={room(2)} onAction={onAction} />);
      await userEvent.click(screen.getByRole("button", { name: "READY" }));
      expect(onAction).toHaveBeenCalledWith("ready", { ready: true });

      rerender(<RoomScreen state={room(2, undefined, { ready: { 1: false, 2: true } })} onAction={onAction} />);
      const cancel = screen.getByRole("button", { name: "CANCEL READY" });
      expect(cancel).not.toHaveAttribute("aria-pressed");
      await userEvent.click(cancel);
      expect(onAction).toHaveBeenLastCalledWith("ready", { ready: false });
    });

    it("ignores a second press while the first is in flight", async () => {
      let resolve!: (ok: boolean) => void;
      onAction.mockImplementationOnce(() => new Promise<boolean>((r) => (resolve = r)));
      render(<RoomScreen state={room(1)} onAction={onAction} />);
      const button = screen.getByRole("button", { name: "READY" });
      await userEvent.click(button);
      await userEvent.click(button);
      expect(onAction).toHaveBeenCalledTimes(1);
      await act(async () => resolve(true));
    });

    it("a failed READY says so", async () => {
      onAction.mockResolvedValueOnce(false);
      render(<RoomScreen state={room(1)} onAction={onAction} />);
      await userEvent.click(screen.getByRole("button", { name: "READY" }));
      expect(messageLines("alert")).toEqual(["Something went wrong.", "Try again."]);
    });

    it("ticks each ready player; the row text is unchanged", () => {
      render(<RoomScreen state={room(1, undefined, { ready: { 1: true, 2: true }, startAt: null })} onAction={onAction} />);
      expect(screen.getAllByRole("img", { name: "Ready" })).toHaveLength(2);
      expect(playerRows()).toEqual(["P1AshHOST", "P2Misty"]);
    });

    it("shows no tick before the room is full", () => {
      render(<RoomScreen state={room(1, [host], { ready: { 1: true, 2: false } })} onAction={onAction} />);
      expect(screen.queryAllByRole("img", { name: "Ready" })).toEqual([]);
    });

    it.each([
      ["you're ready", 1, { ready: { 1: true, 2: false } }, ["Waiting for MISTY", "to get ready..."]],
      ["the opponent is ready", 1, { ready: { 1: false, 2: true } }, ["MISTY is ready!", "Ready to battle?"]],
      ["the guest sees the host ready", 2, { ready: { 1: true, 2: false } }, ["ASH is ready!", "Ready to battle?"]],
      ["options changed", 2, { optionsChanged: true }, ["Battle options changed.", "Ready up again."]],
      ["options changed, then you readied", 2, { optionsChanged: true, ready: { 1: false, 2: true } }, ["Waiting for ASH", "to get ready..."]],
    ] as const)("message when %s", (_, you, lobby, lines) => {
      render(<RoomScreen state={room(you, undefined, lobby)} onAction={onAction} />);
      expect(messageLines()).toEqual(lines);
    });
  });

  describe("countdown", () => {
    const counting = (startAt: number, serverNow: number) =>
      room(1, undefined, { ready: { 1: true, 2: true }, startAt, serverNow });

    it("counts 2, 1, then asks the server to start", async () => {
      vi.useFakeTimers({ now: 10_000 });
      // The server's clock is 5s ahead of this one.
      render(<RoomScreen state={counting(17_000, 15_000)} onAction={onAction} />);
      expect(messageLines()).toEqual(["Both players ready!", "Starting in 2..."]);
      await act(async () => vi.advanceTimersByTime(1_250));
      expect(messageLines()).toEqual(["Both players ready!", "Starting in 1..."]);
      expect(onAction).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(1_000));
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith("start");
    });

    it("starts at once when the countdown is already over (a refresh)", async () => {
      vi.useFakeTimers({ now: 10_000 });
      render(<RoomScreen state={counting(9_000, 10_000)} onAction={onAction} />);
      expect(messageLines()).toEqual(["Both players ready!", "Starting in 1..."]);
      await act(async () => vi.advanceTimersByTime(START_DELAY));
      expect(onAction).toHaveBeenCalledWith("start");
    });

    it("stops when the countdown is cancelled", async () => {
      vi.useFakeTimers({ now: 10_000 });
      const { rerender } = render(<RoomScreen state={counting(12_000, 10_000)} onAction={onAction} />);
      await act(async () => vi.advanceTimersByTime(1_000));
      rerender(
        <RoomScreen
          state={room(1, undefined, { version: 2, ready: { 1: true, 2: false }, startAt: null })}
          onAction={onAction}
        />,
      );
      expect(messageLines()).toEqual(["Waiting for MISTY", "to get ready..."]);
      await act(async () => vi.advanceTimersByTime(5_000));
      expect(onAction).not.toHaveBeenCalled();
    });

    it("retries a failed start once, then says so", async () => {
      vi.useFakeTimers({ now: 10_000 });
      onAction.mockResolvedValue(false);
      render(<RoomScreen state={counting(10_000, 10_000)} onAction={onAction} />);
      await act(async () => vi.advanceTimersByTime(START_DELAY));
      expect(onAction).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTime(500));
      expect(onAction).toHaveBeenCalledTimes(2);
      expect(messageLines("alert")).toEqual(["Something went wrong.", "Try again."]);
      await act(async () => vi.advanceTimersByTime(5_000));
      expect(onAction).toHaveBeenCalledTimes(2);
    });
  });

  it("a notice replaces the message", () => {
    render(<RoomScreen state={room(1, [host])} onAction={onAction} notice={["Oops.", "Try again."]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Oops.Try again.");
    expect(screen.queryByText("Send this code to a friend.")).toBeNull();
  });

  it("names render as text", () => {
    const evil = { id: "a", name: "<b>x</b>", trainer: null, slot: 1 as const };
    const { container } = render(<RoomScreen state={room(2, [evil, guest])} onAction={onAction} />);
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });
});

/** The start request goes this long after the countdown ends. */
const START_DELAY = 100;
