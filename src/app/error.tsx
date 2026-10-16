"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded border border-line bg-card p-4">
      <p className="font-medium">Не удалось загрузить страницу.</p>
      <p className="text-sm text-muted">Проверьте, что база данных запущена и миграции применены.</p>
      <button type="button" onClick={reset} className="rounded bg-ink px-4 py-1.5 text-sm text-paper">Повторить</button>
    </div>
  );
}
