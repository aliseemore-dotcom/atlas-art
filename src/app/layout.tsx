import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Древо художников — атлас истории изобразительного искусства", template: "%s · Древо художников" },
  description:
    "Интерактивный обучающий атлас истории изобразительного искусства: хронология, художники, направления. Первый модуль — Русь, Российская империя, СССР и Россия.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <a href="#content" className="skip-link">Перейти к содержимому</a>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-semibold text-ink no-underline" style={{ letterSpacing: "-0.03em" }}>
              Древо <span className="text-wine">художников</span>
            </Link>
            <nav aria-label="Основная навигация" className="flex gap-6 text-[15px]">
              <Link href="/regions/russia/tree" className="text-rose-dust no-underline hover:text-ink">Древо</Link>
              <Link href="/regions/russia" className="text-rose-dust no-underline hover:text-ink">Хронология</Link>
            </nav>
          </div>
        </header>
        <main id="content" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="label mx-auto max-w-6xl px-4 py-8 text-rose-dust">
          Черновой учебный набор данных: записи ожидают проверки по музейным и научным источникам и не заменяют каталог.
        </footer>
      </body>
    </html>
  );
}
