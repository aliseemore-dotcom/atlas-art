import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSeedCsv, splitLabels } from "./seed";

const HEADER =
  "id,name_ru,birth_year,death_year,era_label,movement_labels,genre_labels,date_precision,verification_status,importance\n";

describe("parseSeedCsv", () => {
  it("импортирует настоящий черновой набор без ошибок", () => {
    const csv = readFileSync(path.resolve(__dirname, "../../../data/artists_seed.csv"), "utf8");
    const { records, issues } = parseSeedCsv(csv);
    expect(issues).toEqual([]);
    expect(records).toHaveLength(114);
    expect(new Set(records.map((r) => r.slug)).size).toBe(114);
    expect(records.every((r) => r.verificationStatus === "needs_review")).toBe(true);
  });

  it("пустые годы — null, не 0; точность отсутствующего года unknown", () => {
    const { records } = parseSeedCsv(
      HEADER + "t1,Тест Один,1949,,Эпоха,Реализм,портрет,exact,needs_review,core\n",
    );
    expect(records[0]).toMatchObject({
      birthYear: 1949,
      deathYear: null,
      birthPrecision: "exact",
      deathPrecision: "unknown",
    });
  });

  it("отклоняет birth > death и повторяющиеся id, остальные строки не страдают", () => {
    const { records, issues } = parseSeedCsv(
      HEADER +
        "a,Плохой,1900,1800,,,,exact,needs_review,core\n" +
        "b,Хороший,1800,1900,,,,exact,needs_review,core\n" +
        "b,Дубль,1800,1900,,,,exact,needs_review,core\n",
    );
    expect(records.map((r) => r.seedId)).toEqual(["b"]);
    expect(issues.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("отклоняет неизвестный статус", () => {
    const { issues } = parseSeedCsv(HEADER + "a,X,1800,1900,,,,exact,approved,core\n");
    expect(issues).toHaveLength(1);
  });

  it("slug детерминирован, коллизии получают суффикс", () => {
    const { records } = parseSeedCsv(
      HEADER +
        "a,Иван Иванов,1800,1900,,,,exact,needs_review,core\n" +
        "b,Иван Иванов,1810,1910,,,,exact,needs_review,core\n",
    );
    expect(records.map((r) => r.slug)).toEqual(["ivan-ivanov", "ivan-ivanov-2"]);
  });
});

describe("splitLabels", () => {
  it("склеивает варианты регистра и убирает пустые", () => {
    expect(splitLabels("модерн, Модерн,, лучизм")).toEqual(["Модерн", "Лучизм"]);
  });
});
