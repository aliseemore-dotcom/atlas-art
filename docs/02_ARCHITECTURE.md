# 02 — Техническая архитектура

## Монорепозиторий приложения
- Next.js App Router + TypeScript strict.
- Tailwind и CSS variables — UI-токены.
- React Flow — дерево направлений и связи художников.
- D3 scale/zoom — отдельный канвас хронологии, исторически точное позиционирование.
- Prisma + PostgreSQL — нормализованная база.
- Zod — валидация форм, API и импортов.
- Vitest/Testing Library — модульные/компонентные тесты; Playwright — e2e.

## Рекомендуемые пути
```
src/app/(public)/page.tsx
src/app/(public)/regions/[slug]/page.tsx
src/app/(public)/artists/[slug]/page.tsx
src/app/(public)/movements/[slug]/page.tsx
src/app/(public)/artworks/[slug]/page.tsx
src/app/api/artists/route.ts
src/app/api/timeline/route.ts
src/components/timeline/*
src/components/graph/*
src/components/artist/*
src/components/filters/*
src/lib/db.ts
src/lib/queries/*
src/lib/timeline/*
src/lib/import/*
prisma/schema.prisma
prisma/seed.ts
```

## API: минимальный контракт
- `GET /api/artists?q=&from=&to=&genre=&movement=&region=&page=` — выдача с пагинацией.
- `GET /api/timeline?region=&from=&to=&mode=life|active` — оптимизированные записи для визуализации; не грузить полные биографии.
- `GET /api/artists/:slug` — карточка; допустимо серверным запросом без отдельного API.
- `GET /api/movements` — направления, интервалы и связи.
- `GET /api/relationships?artistId=` — проверенные отношения с ссылками на источники.
- В MVP3 — защищённые mutation routes для прогресса/заметок.

## Производительность
Отображай ограниченное число строк на уровне обзора, кластеризуй по направлению/эпохе при отдалении, реализуй виртуализацию длинных списков. Не допускать >1 тыс. одновременно рендерящихся DOM-узлов без виртуализации. Использовать server-side filtering и URL query params, чтобы ссылки на состояние были переносимыми.

## Импорт данных
CSV -> Zod validation -> staging/review -> upsert по постоянным ID/slug -> журнал ошибок и конфликтов. Никогда не перезаписывать вручную проверенные записи черновыми данными без явного действия.

## Защита
Валидация API, CSRF и RBAC для админки/мутаций, rate-limit на тяжёлых запросах; секреты в env, регулярный backup БД. Изображения — с источником и лицензией; при отсутствии лицензии показывать placeholder.
