import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatLifespan } from "@/lib/timeline/interval";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return prisma.movement.findUnique({
    where: { slug },
    include: {
      artists: {
        include: { artist: true },
        orderBy: { artist: { birthYear: { sort: "asc", nulls: "last" } } },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await load(slug).catch(() => null);
  return { title: m ? m.nameRu : "Направление не найдено" };
}

export default async function MovementPage({ params }: Props) {
  const { slug } = await params;
  const m = await load(slug);
  if (!m) notFound();
  return (
    <article className="space-y-5">
      <nav className="text-sm"><Link href="/regions/russia">← Россия: хронология</Link></nav>
      <h1 className="text-3xl font-semibold">{m.nameRu}</h1>
      <p className="text-muted">
        {m.fromYear !== null || m.toYear !== null
          ? `Годы: ${m.fromYear ?? "?"} – ${m.toYear ?? "?"}`
          : "Годы существования направления в наборе не указаны."}
      </p>
      <p className="text-muted">{m.description ?? "Описание и признаки направления пока не добавлены."}</p>
      <section aria-labelledby="m-artists">
        <h2 id="m-artists" className="text-xl font-semibold">Художники в наборе</h2>
        <ul className="mt-2 divide-y divide-line rounded border border-line bg-card">
          {m.artists.map(({ artist }) => (
            <li key={artist.id} className="flex flex-wrap gap-x-4 px-4 py-2">
              <Link href={`/artists/${artist.slug}`}>{artist.nameRu}</Link>
              <span className="text-sm text-muted">{formatLifespan(artist)}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted">Связи с другими течениями появятся в фазе 2, вместе с источниками.</p>
    </article>
  );
}
