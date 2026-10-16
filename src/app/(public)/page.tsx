import Link from "next/link";
import { listRegions } from "@/lib/queries/artists";

export const dynamic = "force-dynamic";

export default async function Home() {
  let regions: Awaited<ReturnType<typeof listRegions>> = [];
  let failed = false;
  try {
    regions = await listRegions();
  } catch (e) {
    console.error(e);
    failed = true;
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold md:text-4xl">ATLAS ART</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Интерактивный атлас истории изобразительного искусства: когда жили художники, чем они занимались
          и к каким направлениям относятся. Первый модуль — Русь, Российская империя, СССР и современная Россия.
        </p>
      </section>

      <section aria-labelledby="regions-h">
        <h2 id="regions-h" className="text-xl font-semibold">Регионы</h2>
        {failed ? (
          <p role="alert" className="mt-3 rounded border border-line bg-card p-4">
            Не удалось загрузить список регионов. Проверьте, что база данных запущена (см. README), и обновите страницу.
          </p>
        ) : regions.length === 0 ? (
          <p className="mt-3 rounded border border-line bg-card p-4">
            Регионов пока нет. Запустите импорт: <code>npm run db:seed</code>.
          </p>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {regions.map((r) => (
              <li key={r.slug} className="rounded border border-line bg-card p-5">
                <h3 className="text-lg font-semibold">
                  <Link href={`/regions/${r.slug}`}>{r.nameRu}</Link>
                </h3>
                <p className="mt-1 text-sm text-muted">Художников в черновом наборе: {r._count.artists}</p>
              </li>
            ))}
            <li className="rounded border border-dashed border-line p-5 text-muted">
              <h3 className="text-lg font-semibold">Мировое искусство</h3>
              <p className="mt-1 text-sm">Появится позже (этап MVP4).</p>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
