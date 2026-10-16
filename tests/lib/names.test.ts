import { test, expect } from "vitest";
import { normalizeName } from "@/lib/names";

test("normalizeName trims and accepts 1-12 chars", () => {
  expect(normalizeName("  Ash  ")).toBe("Ash");
  expect(normalizeName("a")).toBe("a");
  expect(normalizeName("a".repeat(12))).toBe("a".repeat(12));
});

test("normalizeName rejects empty, whitespace, >12, non-string", () => {
  for (const bad of ["", "   ", "a".repeat(13), undefined, 5]) {
    expect(normalizeName(bad)).toBeNull();
  }
});
