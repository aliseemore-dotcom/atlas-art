import Link from "next/link";
import type { TreeView } from "@/lib/tree/assemble";

const TYPE_LABEL = { teacher_of: "учитель", influenced: "повлиял на", collaborated: "работали вместе" } as const;

/** Списковый вид древа: те же данные, поколения как разделы. Запасной вариант для узких экранов и без JS. */
export function TreeList({ tree }: { tree: TreeView }) {
  const rels = Object.values(tree.relationships);
  const bySlug = new Map(tree.nodes.map((n) => [n.slug, n]));
  const ranks = [...new Set(tree.nodes.map((n) => n.rank))].sort((a, b) => a - b);
  return (
    <div className="space-y-6" aria-label="Древо списком">
      {ranks.map((r) => (
        <section key={r} aria-labelledby={`gen-${r}`}>
          <h3 id={`gen-${r}`} className="label text-wine">ПОКОЛЕНИЕ {r + 1}</h3>
          <ul className="mt-2 divide-y divide-line border border-line bg-cream">
            {tree.nodes.filter((n) => n.rank === r).sort((a, b) => a.cx - b.cx).map((n) => {
              const teachers = rels.filter((x) => x.toSlug === n.slug && x.type === "teacher_of");
              const pupils = rels.filter((x) => x.fromSlug === n.slug && x.type === "teacher_of");
              const others = rels.filter((x) => (x.type === "influenced" && (x.fromSlug === n.slug || x.toSlug === n.slug)) || (x.type === "collaborated" && (x.fromSlug === n.slug || x.toSlug === n.slug)));
              const name = (s: string) => bySlug.get(s)?.nameRu ?? s;
              return (
                <li key={n.id} className="px-4 py-3">
                  <Link href={`/artists/${n.slug}`} className="font-semibold">{n.nameRu}</Link>{" "}
                  <span className="index text-muted">{n.years}</span>
                  <dl className="mt-1 space-y-0.5 text-sm">
                    {teachers.length > 0 && <div><dt className="inline text-muted">Учителя: </dt><dd className="inline">{teachers.map((t) => name(t.fromSlug)).join(", ")}</dd></div>}
                    {pupils.length > 0 && <div><dt className="inline text-muted">Ученики: </dt><dd className="inline">{pupils.map((t) => name(t.toSlug)).join(", ")}</dd></div>}
                    {others.map((o) => (
                      <div key={o.id}><dt className="inline text-muted">{TYPE_LABEL[o.type]}: </dt><dd className="inline">{name(o.fromSlug === n.slug ? o.toSlug : o.fromSlug)}</dd></div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
