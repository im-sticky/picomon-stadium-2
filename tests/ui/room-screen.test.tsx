import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomScreen } from "@/app/room/[code]/room-screen";
import type { RoomState } from "@/lib/types";

const host = { id: "a", name: "Ash", slot: 1 as const };
const guest = { id: "b", name: "Misty", slot: 2 as const };

function messageLines() {
  return [...screen.getByRole("status").querySelectorAll("p")].map((p) => p.textContent);
}

function playerRows() {
  const list = within(screen.getByRole("region", { name: "Players" })).getByRole("list");
  return within(list).getAllByRole("listitem").map((li) => li.textContent);
}

afterEach(() => vi.useRealTimers());

describe("RoomScreen", () => {
  it("host alone sees waiting view with code K7PQ and COPY button", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "a", slot: 1 }, players: [host] };
    render(<RoomScreen state={state} />);
    expect(screen.getByRole("heading", { name: "WAITING ROOM" })).toBeInTheDocument();
    const codeBox = screen.getByRole("region", { name: "Room code" });
    expect(within(codeBox).getByText("ROOM CODE")).toBeInTheDocument();
    expect(within(codeBox).getByText("K7PQ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "COPY" })).toBeInTheDocument();
    expect(playerRows()).toEqual(["P1AshHOST", "P2- - - - - -Waiting"]);
    expect(messageLines()).toEqual(["Send this code to a friend.", "Waiting for PLAYER 2..."]);
    expect(screen.queryByRole("button", { name: "START BATTLE" })).toBeNull();
  });

  it("guest alone also sees the waiting view", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "b", slot: 2 }, players: [guest] };
    render(<RoomScreen state={state} />);
    expect(screen.getByRole("heading", { name: "WAITING ROOM" })).toBeInTheDocument();
    expect(screen.queryByText("Both players connected!")).toBeNull();
  });

  it("COPY copies the code and shows COPIED! for 1.5s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const state: RoomState = { code: "K7PQ", you: { id: "a", slot: 1 }, players: [host] };
    render(<RoomScreen state={state} />);
    await user.click(screen.getByRole("button", { name: "COPY" }));
    expect(await navigator.clipboard.readText()).toBe("K7PQ");
    expect(await screen.findByRole("button", { name: "COPIED!" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("button", { name: "COPY" })).toBeInTheDocument();
  });

  it("two players, host: title, both names, host marked HOST, START BATTLE enabled", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "a", slot: 1 }, players: [host, guest] };
    render(<RoomScreen state={state} />);
    expect(screen.getByRole("heading", { name: "ROOM K7PQ" })).toBeInTheDocument();
    expect(playerRows()).toEqual(["P1AshHOST", "P2Misty"]);
    expect(messageLines()).toEqual(["Both players connected!", "Ready to battle?"]);
    expect(screen.queryByRole("button", { name: /COPY/ })).toBeNull();
    expect(screen.getByRole("button", { name: "START BATTLE" })).toBeEnabled();
  });

  it("two players, guest: no START BATTLE, waits for the host", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "b", slot: 2 }, players: [host, guest] };
    render(<RoomScreen state={state} />);
    expect(playerRows()).toEqual(["P1AshHOST", "P2Misty"]);
    expect(messageLines()).toEqual(["Both players connected!", "Waiting for PLAYER 1..."]);
    expect(screen.queryByRole("button", { name: "START BATTLE" })).toBeNull();
  });

  it("a notice replaces the message", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "a", slot: 1 }, players: [host] };
    render(<RoomScreen state={state} notice={["Oops.", "Try again."]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Oops.Try again.");
    expect(screen.queryByText("Send this code to a friend.")).toBeNull();
  });

  it("names render as text", () => {
    const evil = { id: "a", name: "<b>x</b>", slot: 1 as const };
    const state: RoomState = { code: "K7PQ", you: { id: "b", slot: 2 }, players: [evil, guest] };
    const { container } = render(<RoomScreen state={state} />);
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });
});
