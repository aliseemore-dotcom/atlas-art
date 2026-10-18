import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtistBySlug, getContemporaries } from "@/lib/queries/artists";
import { getArtistRelationships } from "@/lib/queries/tree";
import { formatLifespan, formatYear } from "@/lib/timeline/interval";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArtistBySlug(slug).catch(() => null);
  if (!a) return { title: "Художник не найден" };
  return {
    title: a.nameRu,
    description: `${a.nameRu}, ${formatLifespan(a)}. Карточка из чернового учебного набора ATLAS ART; данные требуют проверки.`,
  };
}

const STATUS: Record<string, string> = {
  draft: "Черновик",
  needs_review: "Требует проверки",
  verified: "Проверено",
};

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();
  const contemporaries = await getContemporaries(artist);
  const relations = await getArtistRelationships(artist.id);
  const unverified = artist.verificationStatus !== "verified";
  const region = artist.regions[0]?.region;

  return (
    <article className="space-y-6">
      <nav aria-label="Навигация" className="text-sm">
        <Link href={region ? `/regions/${region.slug}` : "/"}>← {region ? `${region.nameRu}: хронология` : "На главную"}</Link>
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row">
        <div
          role="img"
          aria-label="Изображение отсутствует"
          className="flex h-40 w-32 shrink-0 items-center justify-center  border border-dashed border-line bg-card text-center text-xs text-muted"
        >
          Фото нет: права на изображение не подтверждены
        </div>
        <div>
          <h1 className="text-3xl font-semibold">{artist.nameRu}</h1>
          {artist.nameOriginal && <p className="text-muted">{artist.nameOriginal}</p>}
          <p className="mt-1 text-lg">{formatLifespan(artist)}</p>
          <p className="mt-1 text-sm text-muted">
            Рождение: {formatYear(artist.birthYear, artist.birthPrecision)}; смерть: {formatYear(artist.deathYear, artist.deathPrecision)}.
            {artist.deathYear === null && artist.birthYear !== null && " Год смерти в наборе не указан."}
          </p>
          <p className="mt-2">
            <span className={`inline-block  px-2 py-0.5 text-sm ${unverified ? "bg-line" : "bg-brass text-ink"}`}>
              {STATUS[artist.verificationStatus]}
            </span>
          </p>
        </div>
      </header>

      {unverified && (
        <p role="note" className="border border-line bg-card p-3 text-sm">
          Данные карточки взяты из чернового учебного набора и ещё не сверены с музейными и научными источниками.
        </p>
      )}

      <section aria-labelledby="tags-h">
        <h2 id="tags-h" className="text-xl font-semibold">Направления и жанры</h2>
        <dl className="mt-2 space-y-2 text-sm">
          <div>
            <dt className="inline font-medium">Направления: </dt>
            <dd className="inline">
              {artist.movements.length === 0 ? "не указаны" : artist.movements.map((m, i) => (
                <span key={m.movementId}>{i > 0 && ", "}<Link href={`/movements/${m.movement.slug}`}>{m.movement.nameRu}</Link></span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Жанры: </dt>
            <dd className="inline">{artist.genres.length === 0 ? "не указаны" : artist.genres.map((g) => g.genre.nameRu).join(", ")}</dd>
          </div>
          {artist.eraLabel && (
            <div>
              <dt className="inline font-medium">Ярлык черновика: </dt>
              <dd className="inline">{artist.eraLabel} <span className="text-muted">(рабочая метка, не направление)</span></dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="bio-h">
        <h2 id="bio-h" className="text-xl font-semibold">Биография</h2>
        <p className="mt-2 text-muted">{artist.bio ?? "Биография пока не добавлена."}</p>
      </section>

      <section aria-labelledby="works-h">
        <h2 id="works-h" className="text-xl font-semibold">Произведения</h2>
        <p className="mt-2 text-muted">Карточки произведений появятся позже (фаза 3), после проверки атрибуции и прав на изображения.</p>
      </section>

      <section aria-labelledby="rel-h">
        <h2 id="rel-h" className="text-xl">Учителя, ученики, связи</h2>
        {relations.length === 0 ? (
          <p className="mt-2 text-muted">Связей (учитель, влияние, сотрудничество) пока нет: они добавляются вместе с источниками.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2 text-sm">
              {relations.map((r) => {
                const other = r.fromArtistId === artist.id ? r.to : r.from;
                const label =
                  r.type === "teacher_of" ? (r.fromArtistId === artist.id ? "Ученик" : "Учитель") : r.type === "influenced" ? (r.fromArtistId === artist.id ? "Повлиял на" : "Испытал влияние") : "Работали вместе";
                return (
                  <li key={r.id}>
                    <span className="text-muted">{label}:</span> <Link href={`/artists/${other.slug}`}>{other.nameRu}</Link>{" "}
                    {r.verificationStatus === "verified" ? (
                      <span className="label text-heavenly-ink">ПОДТВЕРЖДЕНО</span>
                    ) : (
                      <span className="label text-rose-dust">НЕ СВЕРЕНО</span>
                    )}
                    {r.sources.map((x) => (
                      <span key={x.sourceId} className="block text-xs text-muted">{x.source.title}</span>
                    ))}
                  </li>
                );
              })}
            </ul>
            {relations.some((r) => r.verificationStatus !== "verified") && (
              <p className="mt-2 text-sm text-muted">Связи со статусом «не сверено» внесены в черновик без источника и не являются подтверждёнными фактами.</p>
            )}
            <p className="mt-2 text-sm"><Link href={`/regions/${region?.slug ?? "russia"}/tree`}>Открыть древо</Link></p>
          </>
        )}
      </section>

      <section aria-labelledby="cont-h">
        <h2 id="cont-h" className="text-xl font-semibold">Современники</h2>
        <p className="mt-1 text-sm text-muted">
          Вычисляется автоматически по пересечению лет жизни ({contemporaries.length}). Это не означает знакомства или влияния.
        </p>
        {contemporaries.length === 0 ? (
          <p className="mt-2 text-muted">
            {artist.birthYear === null || artist.deathYear === null
              ? "Для расчёта нужны известные годы рождения и смерти."
              : "В наборе нет художников с пересекающимися годами жизни."}
          </p>
        ) : (
          <ul className="mt-2 columns-1 gap-6 text-sm sm:columns-2">
            {contemporaries.map((c) => (
              <li key={c.slug}><Link href={`/artists/${c.slug}`}>{c.nameRu}</Link> <span className="text-muted">{formatLifespan(c)}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="src-h">
        <h2 id="src-h" className="text-xl font-semibold">Источники</h2>
        <p className="mt-2 text-muted">Источники для этой карточки пока не добавлены; сведения требуют проверки.</p>
      </section>
    </article>
  );
}
