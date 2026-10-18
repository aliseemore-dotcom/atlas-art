import Link from "next/link";
import type { Filters } from "@/lib/filters";
import { hasActiveFilters } from "@/lib/filters";

interface Option { slug: string; nameRu: string }

/** Обычная GET-форма: работает без JS, а состояние фильтров хранится в URL и переносимо. */
export function FilterBar({
  action,
  filters,
  genres,
  movements,
}: {
  action: string;
  filters: Filters;
  genres: Option[];
  movements: Option[];
}) {
  const field = "w-full  border border-line bg-white px-2 py-1.5 text-sm";
  return (
    <form action={action} method="get" role="search" aria-label="Фильтры художников" className="border border-line bg-card p-4">
      {filters.view && <input type="hidden" name="view" value={filters.view} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm lg:col-span-2">
          <span className="mb-1 block font-medium">Поиск по имени</span>
          <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="например, Шишкин" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Год от</span>
          <input type="number" name="from" defaultValue={filters.from ?? ""} inputMode="numeric" min={-3000} max={2100} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Год до</span>
          <input type="number" name="to" defaultValue={filters.to ?? ""} inputMode="numeric" min={-3000} max={2100} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Жанр</span>
          <select name="genre" defaultValue={filters.genre ?? ""} className={field}>
            <option value="">Все жанры</option>
            {genres.map((g) => <option key={g.slug} value={g.slug}>{g.nameRu}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Направление</span>
          <select name="movement" defaultValue={filters.movement ?? ""} className={field}>
            <option value="">Все направления</option>
            {movements.map((m) => <option key={m.slug} value={m.slug}>{m.nameRu}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-pill btn-sm">Применить</button>
        {hasActiveFilters(filters) && (
          <Link href={filters.view ? `${action}?view=${filters.view}` : action} className="text-sm">Сбросить фильтры</Link>
        )}
        <span className="text-xs text-muted">Один год: укажите его в обоих полях. Диапазон по датам жизни.</span>
      </div>
    </form>
  );
}
