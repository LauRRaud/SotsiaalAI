import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Deploy-järgne smoke-test: rakendus vastab ja põhiandmebaas on kättesaadav.
// Vastus ei sisalda versiooni, konfiguratsiooni ega veateksti.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers });
  }
}
