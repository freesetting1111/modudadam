import { NextRequest, NextResponse } from "next/server";
import { createEventEntryRedirect, EventError } from "@/domains/events/events.service";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: RouteContext<"/api/events/entry/[eventNo]">) {
  const { eventNo } = await context.params;
  try { return NextResponse.redirect(await createEventEntryRedirect(request, eventNo), 302); }
  catch (error) {
    console.error("Failed to create event entry", error);
    const fallback = new URL("/events", process.env.FRONTEND_URL || "http://localhost:3005");
    fallback.searchParams.set("eventError", error instanceof EventError ? error.code : "unavailable");
    return NextResponse.redirect(fallback, 302);
  }
}
