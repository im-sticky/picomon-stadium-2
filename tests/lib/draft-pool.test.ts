import { describe, expect, it } from "vitest";
import { dexOrder, draftPool } from "@/lib/draft-pool";

describe("draftPool order", () => {
  const ids = draftPool().map((p) => p.id);

  it("is in Pokédex order", () => {
    expect(ids.indexOf("charizard")).toBeLessThan(ids.indexOf("blastoise"));
    expect(ids.indexOf("blastoise")).toBeLessThan(ids.indexOf("butterfree"));
    expect(ids.indexOf("ampharos")).toBeLessThan(ids.indexOf("azumarill"));
    expect(ids.at(-1)).toBe("celebi");
  });

  it("puts a later-gen evolution right after its Gen 1–2 relative's number", () => {
    expect(dexOrder("magnezone")).toEqual([82, 462]);
    expect(dexOrder("electivire")).toEqual([125, 466]);
    expect(dexOrder("magneton")).toEqual([82, 82]);
    // After everything up to #82 Magneton, before everything after it.
    const at = ids.indexOf("magnezone");
    ids.forEach((id, i) => {
      if (dexOrder(id)[0] <= 82 && id !== "magnezone") expect(i).toBeLessThan(at);
      if (dexOrder(id)[0] > 82) expect(i).toBeGreaterThan(at);
    });
  });

  it("puts Eevee's later-gen evolutions after Espeon and Umbreon", () => {
    expect(["leafeon", "glaceon", "sylveon"].map(dexOrder)).toEqual([
      [197, 470],
      [197, 471],
      [197, 700],
    ]);
    const at = (id: string) => ids.indexOf(id);
    for (const id of ["leafeon", "glaceon", "sylveon"]) {
      if (ids.includes("espeon")) expect(at(id)).toBeGreaterThan(at("espeon"));
      if (ids.includes("umbreon")) expect(at(id)).toBeGreaterThan(at("umbreon"));
    }
    ids.forEach((id, i) => {
      if (dexOrder(id)[0] > 197) expect(i).toBeGreaterThan(at("sylveon"));
    });
  });

  it("sorts every entry by its order key", () => {
    const keys = ids.map(dexOrder);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1][0] * 1000 + keys[i - 1][1]).toBeLessThanOrEqual(keys[i][0] * 1000 + keys[i][1]);
    }
  });
});
