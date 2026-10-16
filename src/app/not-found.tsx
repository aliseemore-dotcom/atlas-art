import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3" role="status">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <p className="text-muted">Такой записи нет в наборе.</p>
      <Link href="/regions/russia">К хронологии</Link>
    </div>
  );
}
