import Link from "next/link";

export function RegionTabs({ slug, active }: { slug: string; active: "tree" | "timeline" }) {
  const base = "label border border-b-0 px-4 py-3 no-underline";
  const on = `${base} border-line bg-cream text-ink`;
  const off = `${base} border-transparent text-muted hover:text-wine`;
  return (
    <nav aria-label="Разделы региона" className="flex flex-wrap gap-1 border-b border-line">
      <Link href={`/regions/${slug}/tree`} aria-current={active === "tree" ? "page" : undefined} className={active === "tree" ? on : off}>Древо</Link>
      <Link href={`/regions/${slug}`} aria-current={active === "timeline" ? "page" : undefined} className={active === "timeline" ? on : off}>Хронология</Link>
      <span aria-disabled="true" title="Появится позже" className={`${base} border-transparent text-muted/70`}>Направления · скоро</span>
    </nav>
  );
}
