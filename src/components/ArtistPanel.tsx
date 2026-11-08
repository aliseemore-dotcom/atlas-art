"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile, SourceRef } from "@/lib/profile";

type State = { status: "loading" } | { status: "error" } | { status: "ok"; profile: Profile };
type Rel = Profile["teachers"][number];

const cache = new Map<string, Profile>();

function sourceLine(s: SourceRef): string {
  return [s.title, s.authorOrInstitution, s.publicationYear, s.page].filter(Boolean).join(", ");
}

function Source({ source }: { source: SourceRef | null }) {
  if (!source) return null;
  return (
    <span className="src">
      Источник:{" "}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer">{sourceLine(source)}</a>
      ) : (
        sourceLine(source)
      )}
    </span>
  );
}

function People({ title, items, onOpen }: { title: string; items: Rel[]; onOpen: (slug: string) => void }) {
  if (items.length === 0) return null;
  return (
    <p className="people">
      <span className="muted">{title}: </span>
      {items.map((r, i) => (
        <span key={r.other.slug + r.type + r.direction}>
          {i > 0 && ", "}
          <button type="button" className="linkish" onClick={() => onOpen(r.other.slug)}>{r.other.nameRu}</button>
          {r.status !== "verified" && <span className="tag" title="Связь внесена без подтверждающего источника">не сверено</span>}
        </span>
      ))}
    </p>
  );
}

const REL_LABEL = { influenced: "Влияние", collaborated: "Работали вместе" } as const;

/** Боковое окно: карточка художника. Всё, чего нет в данных, показано как «пока не добавлено», без выдуманного. */
export function ArtistPanel({ slug, onClose, onOpen }: { slug: string; onClose: () => void; onOpen: (slug: string) => void }) {
  // при смене художника родитель пересоздаёт окно по key, поэтому начальное состояние берётся из кэша
  const [state, setState] = useState<State>(() => {
    const hit = cache.get(slug);
    return hit ? { status: "ok", profile: hit } : { status: "loading" };
  });
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cache.has(slug)) return;
    let alive = true;
    fetch(`/api/artists/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Profile>) : Promise.reject(new Error(String(r.status)))))
      .then((p) => {
        cache.set(slug, p);
        if (alive) setState({ status: "ok", profile: p });
      })
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [slug, attempt]);

  useEffect(() => closeRef.current?.focus(), [slug]);

  const p = state.status === "ok" ? state.profile : null;
  return (
    <aside className="panel" aria-label={p ? `Карточка: ${p.nameRu}` : "Карточка художника"} data-testid="artist-panel">
      <button ref={closeRef} type="button" className="panel-close" aria-label="Закрыть карточку" onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l12 12M15 3L3 15" /></svg>
      </button>

      {state.status === "loading" && <p className="muted" role="status">Загрузка…</p>}
      {state.status === "error" && (
        <p role="alert">
          Не удалось загрузить карточку. <button type="button" className="linkish" onClick={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }}>Повторить</button>
        </p>
      )}

      {p && (
        <div className="panel-body">
          <header className="panel-head">
            <div className="panel-portrait">
              {p.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.portrait.url} alt="" />
              ) : (
                <span aria-hidden>{p.nameRu.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
              )}
            </div>
            <div>
              <h2>{p.nameRu}</h2>
              <p className="muted">{p.years}</p>
            </div>
          </header>

          <section>
            <h3>О художнике</h3>
            {p.summary ? (
              <>
                <p>{p.summary.text}</p>
                <Source source={p.summary.source} />
              </>
            ) : (
              <p className="muted">Сводка пока не добавлена.</p>
            )}
          </section>

          <section>
            <h3>Интересные факты</h3>
            {p.facts.length ? (
              <ul className="facts">
                {p.facts.map((f) => (
                  <li key={f.text}>
                    <span>{f.text}</span>
                    <Source source={f.source} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Фактов пока нет.</p>
            )}
          </section>

          <section>
            <h3>Картины</h3>
            {p.works.length ? (
              <ul className="works">
                {p.works.map((w) => (
                  <li key={w.slug}>
                    {w.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.image.url} alt={w.title} />
                    ) : (
                      <div className="noimg">Изображение не показано: права не подтверждены</div>
                    )}
                    <div className="w-title">{w.title}{w.needsReview && <span className="tag">требует проверки</span>}</div>
                    <div className="muted">{[w.years, w.medium, w.collection].filter(Boolean).join(" · ")}</div>
                    {w.image && <div className="src">Изображение: {w.image.credit}. <a href={w.image.sourceUrl} target="_blank" rel="noopener noreferrer">Источник</a></div>}
                    <Source source={w.source} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Картины пока не добавлены.</p>
            )}
          </section>

          <section>
            <h3>Учителя, ученики и связи</h3>
            {p.teachers.length + p.pupils.length + p.others.length + p.groups.length === 0 ? (
              <p className="muted">Подтверждённых связей пока нет.</p>
            ) : (
              <>
                <People title="Учителя" items={p.teachers} onOpen={onOpen} />
                <People title="Ученики" items={p.pupils} onOpen={onOpen} />
                {(["influenced", "collaborated"] as const).map((t) => (
                  <People key={t} title={REL_LABEL[t]} items={p.others.filter((r) => r.type === t)} onOpen={onOpen} />
                ))}
                {p.groups.length > 0 && (
                  <p className="people">
                    <span className="muted">Объединения: </span>
                    {p.groups.map((g, i) => (
                      <span key={g.slug}>
                        {i > 0 && ", "}
                        {g.name}{g.years ? ` (${g.years})` : ""}
                        {g.needsReview && <span className="tag">не сверено</span>}
                      </span>
                    ))}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
