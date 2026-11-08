# Seed data

114 черновых карточек. Все записи нуждаются в индивидуальной проверке дат, классификации и регионального контекста. Данные собраны из обсуждения и **не заменяют музейную каталогизацию**.

Формат `movement_labels` и `genre_labels`: значения через запятую. Не следует воспринимать `era_label` как обязательное единственное направление. Для импорта используйте строки как staging, связывая с нормализованными справочниками.

## Связи, источники, портреты
- `relationships_seed.csv` — связи `teacher_of` (from = учитель, to = ученик), `influenced`, `collaborated`. Все строки — `needs_review`: они внесены без указания источника и **не являются подтверждёнными фактами**. Статус `verified` допустим только со ссылкой на источник из `sources_seed.csv` (колонка `source_ids`, через `;`).
- `sources_seed.csv` — справочник источников (пока пуст).
- `portraits.csv` — портреты: только `public_domain` или `licensed`, обязательны `credit` и `source_url`. `image_url` — внешний адрес или файл из `public/` (например `/portraits/ilya-repin.jpg`). Без этой строки на древе показываются инициалы.
- Связи между современниками не создаются: пересечение лет жизни ничего не доказывает.

## Контент карточки: сводки, факты, картины, объединения
Все файлы — CSV (UTF-8; открываются в Excel и Google Таблицах). Пока пустые: ничего не придумано. Каждая строка проверяется при `npm run db:seed`; при ошибке контент не импортируется, а в консоли указаны файл-раздел, строка и причина.

| Файл | Колонки | Правила |
|---|---|---|
| `summaries.csv` | `artist_slug, summary, source_id` | краткая сводка 20–700 знаков; **источник обязателен**; одна на художника |
| `facts_seed.csv` | `id, artist_slug, text, source_id, sort_order` | факт 10–400 знаков; **источник обязателен**; `sort_order` — порядок показа |
| `artworks_seed.csv` | `id, artist_slugs, title_ru, year_from, year_to, year_precision, medium, collection, image_url, image_rights, image_credit, image_source_url, verification_status, source_id, sort_order` | `artist_slugs` через `;`; изображение допускается только с `image_rights` = `public_domain`/`licensed` **и** `image_credit` **и** `image_source_url`, иначе строка отклоняется (картину можно внести без `image_*`); `verified` требует `source_id`; год картины вне жизни автора — предупреждение |
| `groups_seed.csv` | `id, name_ru, type, from_year, to_year, description, verification_status` | `type`: `artist_collective`, `association`, `school`, `workshop`; направление и жанр — не объединения |
| `memberships_seed.csv` | `artist_slug, group_slug, from_year, to_year, verification_status, source_id` | `group_slug` — транслитерация названия (например, «Передвижники» → `peredvizhniki`); `verified` требует источника; годы участия не берутся из годов объединения |

`artist_slug` — из колонки `slug` базы (например, `ilya-repin`); `source_id` — `id` из `sources_seed.csv`. Тексты сводок и фактов должны быть написаны своими словами или взяты из источника, на использование которого есть право; цитата — с указанием страницы.
