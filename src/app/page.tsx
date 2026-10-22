import { TreeCanvas } from "@/components/TreeCanvas";
import { getTree } from "@/lib/queries/tree";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  // ?draft=1 — предпросмотр: добавляет связи со статусом «ожидает проверки». По умолчанию рисуются только подтверждённые.
  const includeUnverified = (Array.isArray(sp.draft) ? sp.draft[0] : sp.draft) === "1";
  let tree;
  try {
    tree = await getTree("russia", { includeUnverified });
  } catch (e) {
    console.error(e);
    return <div className="tree-state" role="alert">Не удалось загрузить древо. Проверьте, что база данных запущена, и обновите страницу.</div>;
  }
  if (tree.cards.length === 0) {
    return <div className="tree-state" role="status">В базе пока нет художников. Запустите импорт: npm run db:seed.</div>;
  }
  return (
    <main className="tree-page">
      <TreeCanvas tree={tree} />
    </main>
  );
}
