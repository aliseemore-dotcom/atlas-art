import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistList } from "@/components/artist/ArtistList";
import { FilterBar } from "@/components/filters/FilterBar";
import { RegionTabs } from "@/components/tree/RegionTabs";
import { TimelineView } from "@/components/timeline/TimelineView";
import { hasActiveFilters, parseFilters, type Filters } from "@/lib/filters";
import { getFilterOptions, getRegion, listArtistsPage, queryArtists } from "@/lib/queries/artists";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const region = await getRegion(slug).catch(() => null);
  return { title: region ? `${region.nameRu}: хронология` : "Регион" };
}

function href(slug: string, f: Filters, over: Partial<Record<string, string | number | undefined>>) {
  const p = new URLSearchParams();
  const base: Record<string, string | number | undefined> = {
    q: f.q, from: f.from, to: f.to, genre: f.genre, movement: f.movement,
    mode: f.mode === "life" ? undefined : f.mode, view: f.view, ...over,
  };
  for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return `/regions/${slug}${qs ? `?${qs}` : ""}`;
}

export default async function RegionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const filters = parseFilters(await searchParams);

  let data;
  try {
    const region = await getRegion(slug);
    if (!region) notFound();
    const [options, all, page] = await Promise.all([
      getFilterOptions(slug),
      queryArtists(slug, filters),
      listArtistsPage(slug, filters),
    ]);
    data = { region, options, all, page };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // notFound() и другие служебные исключения Next
    console.error(e);
    return (
      <p role="alert" className="border border-line bg-card p-4">
        Не удалось загрузить данные. Проверьте, что база данных запущена и миграции применены (см. README), затем обновите страницу.
      </p>
    );
  }

  const { region, options, all, page } = data;
  const hasRange = filters.from !== undefined || filters.to !== undefined;
  const focusRange: [number, number] | null = hasRange
    ? [filters.from ?? (filters.to as number), filters.to ?? (filters.from as number)]
    : null;
  const view = filters.view;
  const timelineCls = view === "timeline" ? "" : view === "list" ? "hidden" : "hidden md:block";
  const listCls = view === "list" ? "" : view === "timeline" ? "hidden" : "md:hidden";

  return (
    <div className="space-y-5">
      <header>
        <p className="label text-rose-dust">{region.nameRu.toUpperCase()} / ХРОНОЛОГИЯ</p>
        <h1 className="mt-2 text-4xl md:text-6xl">{region.nameRu}</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Русь, Российская империя, СССР и современная Россия. Показаны художники из чернового учебного набора:
          все записи ожидают проверки.
        </p>
      </header>

      <RegionTabs slug={slug} active="timeline" />

      <FilterBar action={`/regions/${slug}`} filters={filters} genres={options.genres} movements={options.movements} />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p aria-live="polite">
          Найдено: <strong>{all.total}</strong>
          {hasRange && all.excludedUndated > 0 && (
            <span className="text-muted"> · без дат не учтено: {all.excludedUndated}</span>
          )}
        </p>
        <div className="ml-auto flex gap-2" role="group" aria-label="Вид">
          <Link href={href(slug, filters, { view: "timeline", page: undefined })} aria-current={view === "timeline" ? "true" : undefined} className="btn-pill btn-sm no-underline">Шкала</Link>
          <Link href={href(slug, filters, { view: "list", page: undefined })} aria-current={view === "list" ? "true" : undefined} className="btn-pill btn-sm no-underline">Список</Link>
        </div>
      </div>

      {all.total === 0 ? (
        <div className="border border-line bg-card p-6" role="status">
          <p className="font-medium">
            {hasActiveFilters(filters) ? "Ничего не найдено по этим условиям." : "В этом регионе пока нет художников."}
          </p>
          {hasActiveFilters(filters) ? (
            <p className="mt-2">
              <Link href={`/regions/${slug}${filters.view ? `?view=${filters.view}` : ""}`}>Сбросить фильтры</Link>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Запустите импорт: <code>npm run db:seed</code>.</p>
          )}
        </div>
      ) : (
        <>
          <div className={timelineCls}>
            <TimelineView
              key={`${filters.q}|${filters.from}|${filters.to}|${filters.genre}|${filters.movement}|${filters.mode}`}
              focusRange={focusRange}
              items={all.items.map((i) => ({
                slug: i.slug, nameRu: i.nameRu, start: i.start, end: i.end,
                birthPrecision: i.birthPrecision, deathPrecision: i.deathPrecision, overlap: i.overlap,
              }))}
            />
          </div>
          <div className={listCls}>
            <ArtistList items={page.items} />
            {page.pageCount > 1 && (
              <nav aria-label="Страницы" className="mt-4 flex items-center gap-4 text-sm">
                {page.page > 1 && <Link href={href(slug, filters, { page: page.page - 1 })}>← Назад</Link>}
                <span>Страница {page.page} из {page.pageCount}</span>
                {page.page < page.pageCount && <Link href={href(slug, filters, { page: page.page + 1 })}>Дальше →</Link>}
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  );
}
