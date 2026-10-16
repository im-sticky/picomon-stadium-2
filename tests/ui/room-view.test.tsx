import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

type Listener = (change: unknown) => void;
const h = vi.hoisted(() => ({
  listeners: [] as Array<{ events: string | string[]; fn: (change: unknown) => void }>,
  subscribeResult: null as null | Promise<unknown>,
  close: vi.fn(),
}));

vi.mock("ably", () => ({
  Realtime: class {
    connection = {
      on: (events: string | string[], fn: Listener) => {
        h.listeners.push({ events, fn });
      },
      off: (...args: unknown[]) => {
        const fn = args[args.length - 1];
        h.listeners = h.listeners.filter((l) => l.fn !== fn);
      },
    };
    channels = {
      get: () => ({ subscribe: () => h.subscribeResult, unsubscribe: vi.fn() }),
    };
    close = h.close;
  },
}));

import { RoomView } from "@/app/room/[code]/room-view";

const roomState = {
  code: "K7PQ",
  you: { id: "a", slot: 1 },
  players: [{ id: "a", name: "Ash", slot: 1 }],
};

beforeEach(() => {
  h.listeners = [];
  h.subscribeResult = Promise.resolve();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(roomState))));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const MSG = "Live updates unavailable — refresh the page.";

describe("RoomView realtime failures", () => {
  it("shows no notice when everything is healthy", async () => {
    render(<RoomView code="K7PQ" />);
    expect(await screen.findByText("Your room code")).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
  });

  it("logs and shows a notice when channel attach fails", async () => {
    h.subscribeResult = Promise.reject(new Error("attach failed"));
    render(<RoomView code="K7PQ" />);
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });

  it("logs and shows a notice when the connection fails", async () => {
    render(<RoomView code="K7PQ" />);
    await screen.findByText("Your room code");
    const l = h.listeners.find((x) => Array.isArray(x.events) && x.events.includes("failed"))!;
    act(() => l.fn({ current: "failed", reason: new Error("boom") }));
    expect(screen.getByText(MSG)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });

  it("removes its connection listeners on unmount", async () => {
    const { unmount } = render(<RoomView code="K7PQ" />);
    await screen.findByText("Your room code");
    unmount();
    expect(h.listeners.filter((l) => l.events === "failed" || Array.isArray(l.events))).toHaveLength(0);
  });
});
