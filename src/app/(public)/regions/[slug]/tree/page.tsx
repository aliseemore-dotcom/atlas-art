import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchRail } from "@/components/tree/BranchRail";
import { RegionTabs } from "@/components/tree/RegionTabs";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { TreeLegend } from "@/components/tree/TreeLegend";
import { TreeList } from "@/components/tree/TreeList";
import { getRegion } from "@/lib/queries/artists";
import { getTree } from "@/lib/queries/tree";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const region = await getRegion(slug).catch(() => null);
  return { title: region ? `${region.nameRu}: древо художников` : "Древо художников" };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TreePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const branch = first(sp.branch)?.slice(0, 100);
  const showUnverified = first(sp.unverified) !== "0";
  const view = first(sp.view) === "list" ? "list" : first(sp.view) === "tree" ? "tree" : undefined;

  let data;
  try {
    const region = await getRegion(slug);
    if (!region) notFound();
    data = { region, tree: await getTree(slug, { branch, showUnverified }) };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return (
      <p role="alert" className="border border-line bg-cream p-4">
        Не удалось загрузить древо. Проверьте, что база данных запущена и миграции применены (см. README), затем обновите страницу.
      </p>
    );
  }
  const { region, tree } = data;
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { branch: tree.current?.key, unverified: showUnverified ? undefined : "0", view, ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return `/regions/${slug}/tree${s ? `?${s}` : ""}`;
  };
  const canvasCls = view === "tree" ? "" : view === "list" ? "hidden" : "hidden md:block";
  const listCls = view === "list" ? "" : view === "tree" ? "hidden" : "md:hidden";
  const railQuery = new URLSearchParams({ ...(showUnverified ? {} : { unverified: "0" }), ...(view ? { view } : {}) }).toString();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="label text-rose-dust">{region.nameRu.toUpperCase()} / ДРЕВО</p>
        <h1 className="text-5xl md:text-7xl">Древо <span className="text-wine">художников</span></h1>
        <p className="max-w-3xl text-xl text-muted" style={{ lineHeight: "30px" }}>
          Кто у кого учился и кто на кого повлиял. Учителя над учеником, ученики под ним.
        </p>
      </header>

      <RegionTabs slug={slug} active="tree" />

      {unverifiedNote(tree.unverifiedCount, showUnverified, q)}

      {!tree.current ? (
        <div role="status" className="border border-line bg-cream p-6">
          <p className="font-medium">
            {tree.unverifiedCount > 0 && !showUnverified
              ? "Подтверждённых связей пока нет."
              : "Связей между художниками пока нет."}
          </p>
          <p className="mt-2 text-sm text-muted">
            Связи «учитель — ученик» добавляются из <code>data/relationships_seed.csv</code> вместе с источниками (<code>npm run db:seed</code>). Совпадение лет жизни связью не считается.
          </p>
          {tree.unverifiedCount > 0 && !showUnverified && (
            <p className="mt-3"><Link href={q({ unverified: undefined })}>Показать связи, ожидающие проверки</Link></p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <BranchRail slug={slug} branches={tree.branches} currentKey={tree.current.key} query={railQuery} />
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="label text-wine" data-testid="branch-label">{tree.current.label}</h2>
              <div className="ml-auto flex gap-2" role="group" aria-label="Вид">
                <Link href={q({ view: "tree" })} aria-current={view === "tree" ? "true" : undefined} className="btn-pill btn-sm no-underline">Древо</Link>
                <Link href={q({ view: "list" })} aria-current={view === "list" ? "true" : undefined} className="btn-pill btn-sm no-underline">Список</Link>
              </div>
            </div>
            <div className={canvasCls}>
              <TreeCanvas key={tree.current.key + String(showUnverified)} tree={tree} />
            </div>
            <div className={listCls}>
              <TreeList tree={tree} />
            </div>
            <TreeLegend />
          </div>
        </div>
      )}
    </div>
  );
}

function unverifiedNote(count: number, show: boolean, q: (o: Record<string, string | undefined>) => string) {
  if (count === 0) return null;
  return (
    <p role="note" className="border border-line bg-cream p-4 text-sm" data-testid="unverified-note">
      <span className="label text-wine">ВАЖНО</span>{" "}
      {show ? (
        <>
          Связи на древе внесены в черновик без указания источника: это <strong>не подтверждённые факты</strong>, они ожидают сверки (статус каждой связи виден в панели выбранного художника).{" "}
          <Link href={q({ unverified: "0" })}>Скрыть неподтверждённые</Link>
        </>
      ) : (
        <>
          Неподтверждённые связи скрыты (их {count}). <Link href={q({ unverified: undefined })}>Показать</Link>
        </>
      )}
    </p>
  );
}
