import { NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { listArtistsPage } from "@/lib/queries/artists";

export const dynamic = "force-dynamic";

// GET /api/artists?q=&from=&to=&genre=&movement=&region=&page=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") || "russia";
  try {
    const result = await listArtistsPage(region, parseFilters(searchParams));
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не удалось загрузить художников" }, { status: 500 });
  }
}
