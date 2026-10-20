import { test, expect } from "vitest";
import { MAX_NAME_LENGTH, normalizeName } from "@/lib/names";

test("MAX_NAME_LENGTH is 10", () => {
  expect(MAX_NAME_LENGTH).toBe(10);
});

test("normalizeName trims and accepts 1-10 chars", () => {
  expect(normalizeName("  Ash  ")).toBe("Ash");
  expect(normalizeName("a")).toBe("a");
  expect(normalizeName("a".repeat(10))).toBe("a".repeat(10));
  expect(normalizeName("  " + "a".repeat(10) + "  ")).toBe("a".repeat(10));
});

test("normalizeName rejects empty, whitespace, >10, non-string", () => {
  for (const bad of ["", "   ", "a".repeat(11), "a".repeat(12), undefined, 5]) {
    expect(normalizeName(bad)).toBeNull();
  }
});
