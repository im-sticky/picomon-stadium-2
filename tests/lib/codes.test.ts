import { test, expect } from "vitest";
import { generateCode, normalizeCode, CODE_ALPHABET } from "@/lib/codes";

test("CODE_ALPHABET is the 31-char unambiguous set", () => {
  expect(CODE_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZ23456789");
});

test("generateCode returns 4 chars from the alphabet", () => {
  for (let i = 0; i < 200; i++) {
    expect(generateCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  }
});

test("normalizeCode trims and uppercases", () => {
  expect(normalizeCode(" k7pq ")).toBe("K7PQ");
});

test("normalizeCode rejects bad input", () => {
  for (const bad of ["", "K7P", "K7PQX", "K0PQ", "KIPQ", "K1PQ", "KLPQ", "KOPQ", 42, null]) {
    expect(normalizeCode(bad)).toBeNull();
  }
});
