import { NextResponse } from "next/server";
import { getArtistProfile } from "@/lib/queries/profile";

export const dynamic = "force-dynamic";

// Карточка художника: сводка, факты, картины, объединения, связи (только то, что можно показывать, с источниками и статусами).
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const profile = await getArtistProfile(slug);
  if (!profile) return NextResponse.json({ error: "Художник не найден" }, { status: 404 });
  return NextResponse.json(profile);
}
