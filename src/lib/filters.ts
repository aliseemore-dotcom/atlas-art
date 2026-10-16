import { z } from "zod";

const optionalInt = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.coerce.number().int().min(-3000).max(2100).optional(),
);
const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(100).optional(),
);

export const filtersSchema = z.object({
  q: optionalStr,
  from: optionalInt,
  to: optionalInt,
  genre: optionalStr,
  movement: optionalStr,
  mode: z.enum(["life", "active"]).catch("life").default("life"),
  view: z.enum(["timeline", "list"]).optional().catch(undefined),
  page: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1).catch(1).default(1)),
});

export type Filters = z.infer<typeof filtersSchema>;

type Raw = Record<string, string | string[] | undefined>;

/** Параметры URL -> типизированные фильтры. Некорректные значения отбрасываются, а не ломают страницу. */
export function parseFilters(raw: Raw | URLSearchParams): Filters {
  const obj: Record<string, string | undefined> = {};
  if (raw instanceof URLSearchParams) {
    raw.forEach((v, k) => (obj[k] = v));
  } else {
    for (const [k, v] of Object.entries(raw)) obj[k] = Array.isArray(v) ? v[0] : v;
  }
  const res = filtersSchema.safeParse(obj);
  if (res.success) return res.data;
  // единичное некорректное поле: разбираем по полям, чтобы остальные фильтры сохранились
  const safe: Record<string, string | undefined> = {};
  for (const key of Object.keys(filtersSchema.shape)) {
    const one = filtersSchema.pick({ [key]: true } as never).safeParse({ [key]: obj[key] });
    if (one.success) safe[key] = obj[key];
  }
  return filtersSchema.parse(safe);
}

export function hasActiveFilters(f: Filters): boolean {
  return Boolean(f.q || f.from !== undefined || f.to !== undefined || f.genre || f.movement);
}
