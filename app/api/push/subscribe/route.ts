import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { PushSubscriptionInput } from "@/lib/types";
export async function POST(request: NextRequest) { const input = await request.json() as PushSubscriptionInput; if (!input.endpoint || !input.keys?.auth || !input.keys?.p256dh) return new NextResponse("Ogiltig prenumeration", { status: 400 }); await store.saveSubscription(input); return NextResponse.json({ ok: true }); }
