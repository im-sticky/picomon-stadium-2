import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomScreen } from "@/app/room/[code]/room-screen";
import type { RoomState } from "@/lib/types";

const host = { id: "a", name: "Ash", slot: 1 as const };
const guest = { id: "b", name: "Misty", slot: 2 as const };

describe("RoomScreen", () => {
  it("host alone sees waiting view with code K7PQ and Copy code button", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "a", slot: 1 }, players: [host] };
    render(<RoomScreen state={state} />);
    expect(screen.getByText("Your room code")).toBeInTheDocument();
    expect(screen.getByText("K7PQ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    expect(screen.getByText("Send this to a friend. Waiting for someone to join…")).toBeInTheDocument();
  });

  it("guest alone also sees the waiting view", () => {
    const state: RoomState = { code: "K7PQ", you: { id: "b", slot: 2 }, players: [guest] };
    render(<RoomScreen state={state} />);
    expect(screen.getByText("Your room code")).toBeInTheDocument();
    expect(screen.queryByText("Both players connected.")).toBeNull();
  });

  it('two players: both names shown, host marked "(host)", "Both players connected."', () => {
    const state: RoomState = { code: "K7PQ", you: { id: "b", slot: 2 }, players: [host, guest] };
    render(<RoomScreen state={state} />);
    expect(screen.getByText("Room K7PQ")).toBeInTheDocument();
    expect(screen.getByText("Ash (host)")).toBeInTheDocument();
    expect(screen.getByText("Misty")).toBeInTheDocument();
    expect(screen.getByText("Both players connected.")).toBeInTheDocument();
  });

  it("names render as text", () => {
    const evil = { id: "a", name: "<b>x</b>", slot: 1 as const };
    const state: RoomState = { code: "K7PQ", you: { id: "b", slot: 2 }, players: [evil, guest] };
    const { container } = render(<RoomScreen state={state} />);
    expect(screen.getByText("<b>x</b> (host)")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });
});
