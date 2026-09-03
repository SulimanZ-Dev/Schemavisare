import { NextRequest, NextResponse } from "next/server";
import { syncSchedule } from "@/lib/sync";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse("Obehörig", { status: 401 }); const state = await syncSchedule(); return NextResponse.json({ ok: !state.error, stale: state.stale, updatedAt: state.snapshot?.fetchedAt, error: state.error }); }
