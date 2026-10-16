import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Направления и интервалы; связи между направлениями — фаза 2.
export async function GET() {
  const movements = await prisma.movement.findMany({
    orderBy: { nameRu: "asc" },
    select: { slug: true, nameRu: true, fromYear: true, toYear: true, description: true, _count: { select: { artists: true } } },
  });
  return NextResponse.json({ items: movements });
}
