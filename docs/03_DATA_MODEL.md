# 03 — Модель данных и качество исторических сведений

## Entities
**Artist**: id, slug, nameRu, nameOriginal?, alternateNames[], birthYear?, deathYear?, activeFrom?, activeTo?, birthPrecision (`exact|circa|range|unknown`), deathPrecision, birthYearMin?, birthYearMax?, deathYearMin?, deathYearMax?, bio?, verificationStatus (`draft|needs_review|verified`), importance (`core|extended`).

**Movement**: id, slug, nameRu, fromYear?, toYear?, description, region references.
**Genre**: id, slug, nameRu, description.
**Group**: id, slug, nameRu, fromYear?, toYear?, type (`artist_collective|association|school|workshop`).
**Region**: id, slug, nameRu, kind (`cultural_region|modern_country|historical_state|city`), activeFrom?, activeTo?.
**Artwork**: id, slug, titleRu, yearFrom?, yearTo?, artist relation(s), medium?, description?, genre(s), currentCollection?, imageUrl?, imageRightsStatus, license?, imageCredit?.
**Relationship**: id, fromArtistId, toArtistId, type (`teacher_of|influenced|collaborated`), fromYear?, toYear?, verificationStatus, evidenceNote?, sources. **Не создавать** явные relationships для каждой пары современников.
**MovementRelationship**: fromMovementId, toMovementId, type (`influenced|developed_into|reacted_against`), verified/source.
**Source**: id, title, authorOrInstitution?, url?, publicationYear?, page?, notes?, sourceType (`museum|catalogue|scholarly|book|other`).
**ArtistMovement**, **ArtistGenre**, **ArtistGroup**, **ArtistRegion**: связующие таблицы many-to-many; у ArtistRegion хранить роль (`born|worked|studied|associated`) и даты.
**FactCitation**: entityType, entityId, fieldName, sourceId, note.
**LearningProgress**, **UserNote**: userId, entityType, entityId, status, timestamps; изолировать авторизацию.

## Важные правила
- Исторический год — integer; BCE поддерживать отрицательными значениями в будущем; для неизвестного — NULL, а не 0.
- Для `circa` хранить признак приблизительности; для интервала — min/max.
- Дата смерти и дата окончания работы — разные значения.
- Во избежание анахронизмов страна рождения и школа не определяют автоматически современное гражданство.
- `contemporary_of` вычислять динамически через пересечение дат жизни или активности (не означает знакомство).
- Нельзя обозначать субъективные влияния как проверенные без ссылок на источники.
- Для художественных коллективов сделать Entity `Group`, а не `Artist` с подложными датами жизни.
- При отсутствии доказанных изображений **не** делать hotlink с поисковиков.

## Дополнительные проверки
`activeFrom <= activeTo`, `birthYear <= deathYear`, связь не направлена художником на себя; при импорте избегать одинакового slug. Соотношение временных интервалов должно обрабатывать null, circa и частично известные даты.

## Состав стартового импорта
`data/artists_seed.csv` содержит канонический небольшой набор из предыдущего обсуждения. Поля: имя, годы, эпоха, направление, жанры, статус. Все записи needs_review. Дополнять после сверки музеями, энциклопедиями и учебной книгой. Нет автоматического создания реальных связей из хронологического совпадения.
