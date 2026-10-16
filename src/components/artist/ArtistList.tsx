import Link from "next/link";
import type { ArtistListItem } from "@/lib/queries/artists";
import { formatLifespan } from "@/lib/timeline/interval";

export function ArtistList({ items }: { items: ArtistListItem[] }) {
  return (
    <ul className="divide-y divide-line rounded border border-line bg-card" aria-label="Список художников">
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
          <Link href={`/artists/${a.slug}`} className="font-medium">{a.nameRu}</Link>
          <span className="text-sm text-muted">{formatLifespan(a)}</span>
          {a.overlap === "maybe" && (
            <span className="rounded bg-line px-1.5 py-0.5 text-xs">часть дат неизвестна</span>
          )}
          <span className="basis-full text-sm text-muted">
            {[...a.movements.map((m) => m.nameRu), ...a.genres.map((g) => g.nameRu)].join(" · ") || "направление и жанр не указаны"}
          </span>
        </li>
      ))}
    </ul>
  );
}
