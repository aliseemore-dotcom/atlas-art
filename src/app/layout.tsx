import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Древо художников",
  description: "Интерактивное древо художников: поколения, современники и подтверждённые связи.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
