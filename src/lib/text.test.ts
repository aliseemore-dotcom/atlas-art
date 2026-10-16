import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeText, queryTokens, slugify } from "./text";

describe("поиск", () => {
  it("не зависит от регистра и нормализует ё/е", () => {
    expect(normalizeText("Андрей Рублёв")).toBe("андрей рублев");
    expect(matchesQuery(normalizeText("Андрей Рублёв"), "РУБЛЕВ")).toBe(true);
    expect(matchesQuery(normalizeText("Андрей Рублев"), "рублёв")).toBe(true);
  });
  it("слова в любом порядке", () => {
    expect(matchesQuery(normalizeText("Иван Шишкин"), "шишкин иван")).toBe(true);
    expect(matchesQuery(normalizeText("Иван Шишкин"), "репин")).toBe(false);
  });
  it("пустой запрос ничего не фильтрует", () => {
    expect(queryTokens("  ")).toEqual([]);
    expect(matchesQuery("любой", "")).toBe(true);
  });
  it("slugify транслитерирует", () => {
    expect(slugify("Илья Репин")).toBe("ilya-repin");
    expect(slugify("Андрей Рублёв")).toBe("andrey-rublev");
  });
});
