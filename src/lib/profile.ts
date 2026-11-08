import { formatYears } from "@/lib/tree/anchor";
import { usablePortrait } from "@/lib/tree/build";
import type { DatePrecision } from "@/lib/timeline/interval";

type Status = "draft" | "needs_review" | "verified";
export interface SourceRef { title: string; authorOrInstitution: string | null; url: string | null; publicationYear: number | null; page: string | null }

export interface ProfileInput {
  artist: {
    id: string; slug: string; nameRu: string;
    birthYear: number | null; deathYear: number | null; birthPrecision: DatePrecision; deathPrecision: DatePrecision;
    bio: string | null; bioSource: SourceRef | null;
    portraitUrl: string | null; portraitRights: "unknown" | "public_domain" | "licensed"; portraitCredit: string | null; portraitSourceUrl: string | null;
  };
  facts: { text: string; sortOrder: number; source: SourceRef | null }[];
  works: {
    slug: string; titleRu: string; yearFrom: number | null; yearTo: number | null; yearPrecision: DatePrecision;
    medium: string | null; currentCollection: string | null; sortOrder: number; verificationStatus: Status;
    imageUrl: string | null; imageRights: "unknown" | "public_domain" | "licensed"; imageCredit: string | null; imageSourceUrl: string | null;
    source: SourceRef | null;
  }[];
  groups: { nameRu: string; slug: string; type: string; fromYear: number | null; toYear: number | null; verificationStatus: Status; source: SourceRef | null }[];
  relations: { type: "teacher_of" | "influenced" | "collaborated"; direction: "out" | "in"; other: { slug: string; nameRu: string }; status: Status; sources: SourceRef[] }[];
}

export interface Profile {
  slug: string;
  nameRu: string;
  years: string;
  portrait: { url: string } | null;
  /** краткая сводка — только вместе с источником */
  summary: { text: string; source: SourceRef } | null;
  /** интересные факты — только с источником */
  facts: { text: string; source: SourceRef }[];
  works: {
    slug: string; title: string; years: string | null; medium: string | null; collection: string | null;
    needsReview: boolean; source: SourceRef | null;
    /** показывается только при подтверждённых правах, авторе и источнике; иначе null — заглушка */
    image: { url: string; credit: string; sourceUrl: string } | null;
  }[];
  groups: { slug: string; name: string; years: string | null; needsReview: boolean; source: SourceRef | null }[];
  teachers: ProfileInput["relations"];
  pupils: ProfileInput["relations"];
  others: ProfileInput["relations"];
}

const yearsOf = (from: number | null, to: number | null, p: DatePrecision = "exact") => {
  if (from === null && to === null) return null;
  const pre = p === "circa" ? "ок. " : "";
  return from !== null && to !== null && from !== to ? `${pre}${from}–${to}` : `${pre}${from ?? to}`;
};

/**
 * Данные -> карточка художника. Правила: ничего без источника (сводка, факты); draft не показывается;
 * изображения только с правами; неподтверждённое помечается needsReview.
 */
export function buildProfile(i: ProfileInput): Profile {
  const a = i.artist;
  const portrait = usablePortrait(a);
  return {
    slug: a.slug,
    nameRu: a.nameRu,
    years: formatYears(a),
    portrait: portrait ? { url: portrait } : null,
    summary: a.bio && a.bioSource ? { text: a.bio, source: a.bioSource } : null,
    facts: i.facts
      .filter((f): f is typeof f & { source: SourceRef } => f.source !== null)
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((f) => ({ text: f.text, source: f.source })),
    works: i.works
      .filter((w) => w.verificationStatus !== "draft")
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((w) => ({
        slug: w.slug,
        title: w.titleRu,
        years: yearsOf(w.yearFrom, w.yearTo, w.yearPrecision),
        medium: w.medium,
        collection: w.currentCollection,
        needsReview: w.verificationStatus !== "verified",
        source: w.source,
        image:
          w.imageUrl && w.imageCredit && w.imageSourceUrl && (w.imageRights === "public_domain" || w.imageRights === "licensed")
            ? { url: w.imageUrl, credit: w.imageCredit, sourceUrl: w.imageSourceUrl }
            : null,
      })),
    groups: i.groups
      .filter((g) => g.verificationStatus !== "draft")
      .map((g) => ({ slug: g.slug, name: g.nameRu, years: yearsOf(g.fromYear, g.toYear), needsReview: g.verificationStatus !== "verified", source: g.source })),
    teachers: i.relations.filter((r) => r.type === "teacher_of" && r.direction === "in" && r.status !== "draft"),
    pupils: i.relations.filter((r) => r.type === "teacher_of" && r.direction === "out" && r.status !== "draft"),
    others: i.relations.filter((r) => r.type !== "teacher_of" && r.status !== "draft"),
  };
}
