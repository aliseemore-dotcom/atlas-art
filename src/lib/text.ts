/** Нормализация для поиска: нижний регистр, ё -> е, без лишних пробелов. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Слова запроса после нормализации. */
export function queryTokens(query: string): string[] {
  const n = normalizeText(query);
  return n ? n.split(" ") : [];
}

/** Все слова запроса должны входить в нормализованный текст (в любом порядке). */
export function matchesQuery(haystackNormalized: string, query: string): boolean {
  return queryTokens(query).every((t) => haystackNormalized.includes(t));
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Детерминированный slug из русского названия. */
export function slugify(input: string): string {
  const out = input
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "item";
}

/** Единый вид ярлыка: пробелы по краям убраны, первая буква заглавная ("модерн" и "Модерн" — одно и то же). */
export function canonicalLabel(label: string): string {
  const t = label.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Римские цифры для номеров ветвей (1 -> I). */
export function toRoman(n: number): string {
  const map: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "";
  let rest = n;
  for (const [v, sym] of map) while (rest >= v) { r += sym; rest -= v; }
  return r;
}

/** Инициалы для медальона без портрета: первые буквы первых двух слов имени, начинающихся с заглавной. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w));
  return words.slice(0, 2).map((w) => w.charAt(0)).join("") || name.charAt(0).toUpperCase();
}

/** Фамилия для меток ветвей: последнее слово, заглавными. */
export function surnameCaps(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? name).toUpperCase();
}
