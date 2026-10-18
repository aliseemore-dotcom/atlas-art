import Link from "next/link";
import type { BranchSummary } from "@/lib/tree/assemble";
import { Medallion } from "./Medallion";

/** Боковая лента ветвей: мини-медальоны мастеров 44×56, активная ветвь — ободок wine. */
export function BranchRail({ slug, branches, currentKey, query }: { slug: string; branches: BranchSummary[]; currentKey: string; query: string }) {
  return (
    <nav aria-label="Ветви древа" className="flex gap-3 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
      {branches.map((b) => {
        const active = b.key === currentKey;
        const qs = new URLSearchParams(query);
        qs.set("branch", b.key);
        return (
          <Link
            key={b.key}
            href={`/regions/${slug}/tree?${qs.toString()}`}
            aria-current={active ? "true" : undefined}
            className="flex min-w-[200px] items-center gap-3 border border-line bg-milk p-2 no-underline hover:border-wine aria-[current=true]:border-wine aria-[current=true]:bg-cream md:min-w-0"
          >
            <span className="flex shrink-0">
              {b.masters[0] && <Medallion role="rail" initials={b.masters[0].initials} portraitUrl={b.masters[0].portraitUrl} active={active} />}
            </span>
            <span className="min-w-0">
              <span className="label block text-wine">{b.label}</span>
              <span className="index block text-muted">{b.count} {pluralArtists(b.count)}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function pluralArtists(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "художник";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "художника";
  return "художников";
}
