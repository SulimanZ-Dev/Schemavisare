import { NextRequest, NextResponse } from "next/server";
import { DEMO_KINDS, getDemoSchedule, type DemoKind } from "@/lib/demo";

export const runtime = "nodejs";
// Ger ett tydligt märkt demotillstånd (mock-data + riktig diff) för Testmiljön.
// ?kind= för att visa en enskild ändringstyp. Rör aldrig riktig schema-/änderingsdata.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("kind");
  const kind: DemoKind = DEMO_KINDS.includes(raw as DemoKind) ? (raw as DemoKind) : "all";
  return NextResponse.json(await getDemoSchedule(kind));
}