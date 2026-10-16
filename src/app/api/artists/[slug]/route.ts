import { NextResponse } from "next/server";
import { getArtistBySlug } from "@/lib/queries/artists";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return NextResponse.json({ error: "Художник не найден" }, { status: 404 });
  return NextResponse.json(artist);
}
