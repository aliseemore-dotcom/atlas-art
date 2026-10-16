import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("разбирает годы и строки", () => {
    const f = parseFilters({ q: " Шишкин ", from: "1880", to: "1890", genre: "peyzazh" });
    expect(f).toMatchObject({ q: "Шишкин", from: 1880, to: 1890, genre: "peyzazh", mode: "life", page: 1 });
  });
  it("мусор отбрасывается, остальное сохраняется", () => {
    const f = parseFilters({ from: "abc", to: "1890", mode: "zzz", page: "-5" });
    expect(f.from).toBeUndefined();
    expect(f.to).toBe(1890);
    expect(f.mode).toBe("life");
    expect(f.page).toBe(1);
  });
  it("пустые значения считаются отсутствующими", () => {
    const f = parseFilters(new URLSearchParams("q=&from=&genre="));
    expect(hasActiveFilters(f)).toBe(false);
  });
});
