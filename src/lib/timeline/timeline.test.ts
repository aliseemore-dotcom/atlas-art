import { describe, expect, it } from "vitest";
import {
  formatLifespan,
  intervalFor,
  isContemporary,
  overlapWithRange,
  type DatedArtist,
} from "./interval";
import { IDENTITY, centuryLabel, createYearScale, ticksFor, yearToX, zoomedScale } from "./scale";

const artist = (o: Partial<DatedArtist>): DatedArtist => ({
  birthYear: null,
  deathYear: null,
  activeFrom: null,
  activeTo: null,
  birthPrecision: "unknown",
  deathPrecision: "unknown",
  ...o,
});

describe("overlapWithRange", () => {
  it("1880–1890: жившие в это время, без привязки к началу эпохи", () => {
    const repin = intervalFor(artist({ birthYear: 1844, deathYear: 1930 }));
    const born1895 = intervalFor(artist({ birthYear: 1895, deathYear: 1960 }));
    const died1879 = intervalFor(artist({ birthYear: 1800, deathYear: 1879 }));
    expect(overlapWithRange(repin, 1880, 1890)).toBe("yes");
    expect(overlapWithRange(born1895, 1880, 1890)).toBe("no");
    expect(overlapWithRange(died1879, 1880, 1890)).toBe("no");
  });
  it("граничные годы включаются", () => {
    expect(overlapWithRange({ start: 1800, end: 1880 }, 1880, 1890)).toBe("yes");
    expect(overlapWithRange({ start: 1890, end: 1950 }, 1880, 1890)).toBe("yes");
  });
  it("перепутанные края диапазона нормализуются", () => {
    expect(overlapWithRange({ start: 1800, end: 1900 }, 1890, 1880)).toBe("yes");
  });
  it("частичные даты дают maybe, а не yes", () => {
    expect(overlapWithRange({ start: 1949, end: null }, 1980, 1990)).toBe("maybe");
    expect(overlapWithRange({ start: null, end: 1900 }, 1880, 1890)).toBe("maybe");
  });
  it("частичные даты не пересекаются, когда это исключено", () => {
    expect(overlapWithRange({ start: 1961, end: null }, 1880, 1890)).toBe("no");
    expect(overlapWithRange({ start: null, end: 1800 }, 1880, 1890)).toBe("no");
  });
  it("без дат — unknown", () => {
    expect(overlapWithRange({ start: null, end: null }, 1880, 1890)).toBe("unknown");
  });
});

describe("intervalFor", () => {
  it("life и active независимы; active берёт жизнь, если период работы неизвестен", () => {
    const a = artist({ birthYear: 1800, deathYear: 1870, activeFrom: 1820, activeTo: 1860 });
    expect(intervalFor(a, "life")).toEqual({ start: 1800, end: 1870 });
    expect(intervalFor(a, "active")).toEqual({ start: 1820, end: 1860 });
    expect(intervalFor(artist({ birthYear: 1800, deathYear: 1870 }), "active")).toEqual({ start: 1800, end: 1870 });
  });
});

describe("isContemporary", () => {
  it("только при известных интервалах", () => {
    expect(isContemporary({ start: 1800, end: 1870 }, { start: 1850, end: 1900 })).toBe(true);
    expect(isContemporary({ start: 1800, end: 1840 }, { start: 1850, end: 1900 })).toBe(false);
    expect(isContemporary({ start: 1800, end: null }, { start: 1850, end: 1900 })).toBe(false);
  });
});

describe("formatLifespan", () => {
  it("неизвестное не заменяется выдуманным", () => {
    expect(formatLifespan(artist({}))).toBe("даты неизвестны");
    expect(formatLifespan(artist({ birthYear: 1949, birthPrecision: "exact" }))).toBe("1949 — ?");
    expect(
      formatLifespan(artist({ birthYear: 1340, deathYear: 1405, birthPrecision: "circa", deathPrecision: "circa" })),
    ).toBe("ок. 1340 — ок. 1405");
  });
});

describe("шкала года", () => {
  const domain: [number, number] = [1000, 2000];
  it("год -> X линейно, независимо от порядка", () => {
    const s = createYearScale(domain, 1000);
    expect(s(1000)).toBe(0);
    expect(s(1500)).toBe(500);
    expect(s(2000)).toBe(1000);
  });
  it("при zoom k=2 сдвиг и масштаб применяются как в d3-zoom", () => {
    // x' = k*x + tx
    expect(yearToX(1500, domain, 1000, { k: 2, x: -500 })).toBeCloseTo(500);
    expect(yearToX(1000, domain, 1000, { k: 2, x: 0 })).toBeCloseTo(0);
    expect(yearToX(1250, domain, 1000, { k: 2, x: 0 })).toBeCloseTo(500);
  });
  it("identity не меняет позиции", () => {
    expect(yearToX(1750, domain, 1000, IDENTITY)).toBeCloseTo(750);
  });
  it("видимый домен сужается при приближении", () => {
    const s = zoomedScale(domain, 1000, { k: 4, x: 0 });
    expect(s.domain()).toEqual([1000, 1250]);
  });
});

describe("метки оси", () => {
  it("века при отдалении, десятилетия и годы при приближении", () => {
    expect(ticksFor([1300, 2030]).every((t) => t.kind === "century")).toBe(true);
    expect(ticksFor([1880, 1890]).every((t) => t.kind === "year")).toBe(true);
    expect(ticksFor([1800, 1900])[0]?.kind).toBe("decade");
    expect(ticksFor([1300, 2030]).map((t) => t.year)).toContain(1900);
  });
  it("подписи веков", () => {
    expect(centuryLabel(1900)).toBe("XIX в.");
    expect(centuryLabel(1901)).toBe("XX в.");
    expect(centuryLabel(1000)).toBe("X в.");
  });
});
