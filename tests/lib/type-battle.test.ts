import { describe, it, expect } from "vitest";
import { isTypeChoice, typeBattleWinner } from "@/lib/type-battle";

describe("typeBattleWinner", () => {
  it("Grass beats Water, Water beats Fire, Fire beats Grass", () => {
    expect(typeBattleWinner("grass", "water")).toBe(1);
    expect(typeBattleWinner("water", "fire")).toBe(1);
    expect(typeBattleWinner("fire", "grass")).toBe(1);
    expect(typeBattleWinner("water", "grass")).toBe(2);
    expect(typeBattleWinner("fire", "water")).toBe(2);
    expect(typeBattleWinner("grass", "fire")).toBe(2);
  });

  it("the same type is a draw", () => {
    expect(typeBattleWinner("grass", "grass")).toBeNull();
    expect(typeBattleWinner("water", "water")).toBeNull();
    expect(typeBattleWinner("fire", "fire")).toBeNull();
  });

  it("isTypeChoice accepts only the three types", () => {
    expect(isTypeChoice("fire")).toBe(true);
    expect(isTypeChoice("FIRE")).toBe(false);
    expect(isTypeChoice("electric")).toBe(false);
    expect(isTypeChoice(undefined)).toBe(false);
  });
});
