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
        <p className="label text-rose-dust">АТЛАС ИСТОРИИ ЖИВОПИСИ</p>
        <h1 className="mt-3 text-5xl md:text-8xl">Древо <span className="text-wine">художников</span></h1>
        <p className="mt-6 max-w-2xl text-xl text-muted" style={{ lineHeight: "30px" }}>
          Интерактивный атлас истории изобразительного искусства: когда жили художники, чем они занимались
          и к каким направлениям относятся. Первый модуль — Русь, Российская империя, СССР и современная Россия.
        </p>
      </section>

      <section aria-labelledby="regions-h">
        <h2 id="regions-h" className="label text-wine">РЕГИОНЫ</h2>
        {failed ? (
          <p role="alert" className="mt-3  border border-line bg-card p-4">
            Не удалось загрузить список регионов. Проверьте, что база данных запущена (см. README), и обновите страницу.
          </p>
        ) : regions.length === 0 ? (
          <p className="mt-3  border border-line bg-card p-4">
            Регионов пока нет. Запустите импорт: <code>npm run db:seed</code>.
          </p>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {regions.map((r) => (
              <li key={r.slug} className="border border-line bg-cream p-6">
                <h3 className="text-3xl">{r.nameRu}</h3>
                <p className="index mt-1 text-rose-dust">{r._count.artists} художников в черновом наборе</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={`/regions/${r.slug}/tree`} className="btn-pill min-w-[260px] no-underline"><span>Открыть древо</span><span aria-hidden>→</span></Link>
                  <Link href={`/regions/${r.slug}`} className="btn-pill no-underline"><span>Хронология</span><span aria-hidden>→</span></Link>
                </div>
              </li>
            ))}
            <li className="border border-dashed border-crust p-6 text-muted">
              <h3 className="text-lg font-semibold">Мировое искусство</h3>
              <p className="mt-1 text-sm">Появится позже (этап MVP4).</p>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
