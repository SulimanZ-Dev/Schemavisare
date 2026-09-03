import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getPublicSchedule, syncSchedule } from "@/lib/sync";
export const runtime = "nodejs";
export async function GET() { const state = await (await store.refreshAllowed() ? syncSchedule() : getPublicSchedule()); return NextResponse.json(state, { status: state.error && !state.snapshot ? 503 : 200 }); }
