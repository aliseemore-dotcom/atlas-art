import { NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { queryArtists } from "@/lib/queries/artists";

export const dynamic = "force-dynamic";

// GET /api/timeline?region=&from=&to=&mode=life|active — только поля, нужные для оси (без биографий)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "russia";
  try {
    const { items, excludedUndated } = await queryArtists(region, parseFilters(searchParams));
    return NextResponse.json({
      excludedUndated,
      items: items.map((i) => ({
        slug: i.slug,
        nameRu: i.nameRu,
        start: i.start,
        end: i.end,
        birthPrecision: i.birthPrecision,
        deathPrecision: i.deathPrecision,
        overlap: i.overlap,
        verificationStatus: i.verificationStatus,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не удалось загрузить хронологию" }, { status: 500 });
  }
}
