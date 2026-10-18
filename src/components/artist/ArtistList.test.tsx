import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ArtistListItem } from "@/lib/queries/artists";
import { ArtistList } from "./ArtistList";

const base: ArtistListItem = {
  id: "1", slug: "test", nameRu: "Тест Тестов", birthYear: null, deathYear: null,
  activeFrom: null, activeTo: null, birthPrecision: "unknown", deathPrecision: "unknown",
  eraLabel: null, verificationStatus: "needs_review", movements: [], genres: [],
  start: null, end: null, overlap: null,
};

describe("ArtistList", () => {
  it("художник без дат и без направлений не ломает список и не получает выдуманных значений", () => {
    render(<ArtistList items={[base]} />);
    expect(screen.getByRole("link", { name: "Тест Тестов" })).toHaveAttribute("href", "/artists/test");
    expect(screen.getByText("даты неизвестны")).toBeInTheDocument();
    expect(screen.getByText("направление и жанр не указаны")).toBeInTheDocument();
  });

  it("частичные даты помечены", () => {
    render(<ArtistList items={[{ ...base, birthYear: 1949, birthPrecision: "exact", start: 1949, overlap: "maybe" }]} />);
    expect(screen.getByText("1949 — ?")).toBeInTheDocument();
    expect(screen.getByText("часть дат неизвестна")).toBeInTheDocument();
  });
});
