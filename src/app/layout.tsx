import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ATLAS ART — атлас истории изобразительного искусства", template: "%s · ATLAS ART" },
  description:
    "Интерактивный обучающий атлас истории изобразительного искусства: хронология, художники, направления. Первый модуль — Русь, Российская империя, СССР и Россия.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <a href="#content" className="skip-link">Перейти к содержимому</a>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-serif text-xl font-semibold tracking-wide text-ink no-underline">
              ATLAS&nbsp;ART
            </Link>
            <nav aria-label="Основная навигация">
              <Link href="/regions/russia" className="text-sm">Россия</Link>
            </nav>
          </div>
        </header>
        <main id="content" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
          Черновой учебный набор данных: записи ожидают проверки по музейным и научным источникам и не заменяют каталог.
        </footer>
      </body>
    </html>
  );
}
