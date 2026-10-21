import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { NEXT_ROUND_DELAY_MS, TypeBattleScreen } from "@/app/room/[code]/type-battle-screen";
import type { RoomState, TypeBattleView } from "@/lib/types";

const draw: TypeBattleView = { round: 1, yourPick: "fire", opponentPick: "fire", winner: null, firstDrafter: null };
const state: RoomState = {
  code: "K7PQ",
  you: { id: "a", slot: 1 },
  players: [
    { id: "a", name: "Ash", slot: 1 },
    { id: "b", name: "Misty", slot: 2 },
  ],
  phase: "type-battle",
  battleSize: 6,
  typeBattle: draw,
  draft: null,
  battle: null,
};

afterEach(() => vi.useRealTimers());

describe("TypeBattleScreen after a draw", () => {
  it("asks for the next round once, 2s after the draw, with no button", async () => {
    vi.useFakeTimers();
    const onAction = vi.fn(async () => true);
    render(<TypeBattleScreen state={state} battle={draw} onAction={onAction} />);
    expect(screen.getByRole("status")).toHaveTextContent("Both chose FIRE!Choose again.");
    expect(screen.queryByRole("button", { name: /again/i })).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(NEXT_ROUND_DELAY_MS - 1));
    expect(onAction).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("again", { round: 1 });
    await act(() => vi.advanceTimersByTimeAsync(NEXT_ROUND_DELAY_MS * 3));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not ask after unmounting", async () => {
    vi.useFakeTimers();
    const onAction = vi.fn(async () => true);
    const { unmount } = render(<TypeBattleScreen state={state} battle={draw} onAction={onAction} />);
    await act(() => vi.advanceTimersByTimeAsync(NEXT_ROUND_DELAY_MS - 1));
    unmount();
    await vi.advanceTimersByTimeAsync(NEXT_ROUND_DELAY_MS);
    expect(onAction).not.toHaveBeenCalled();
  });
});
