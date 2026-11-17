import { NextRequest, NextResponse } from "next/server";
import { EVENT_SESSION_COOKIE } from "@/shared/event-session";

export const runtime = "nodejs";
const backendUrl = (process.env.MODUDADAM_BACKEND_URL || "http://localhost:3004").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket");
  const nextPath = normalizePath(request.nextUrl.searchParams.get("next"));
  if (!ticket) return NextResponse.redirect(new URL("/events", mainUrl()), 302);
  const response = await fetch(`${backendUrl}/api/events/sessions/consume`, {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
  if (!response.ok) return NextResponse.redirect(new URL("/events", mainUrl()), 302);
  const envelope = await response.json() as { success: true; data: {
    eventSessionToken: string; expiresAt: string; returnPath?: string;
  } };
  const destination = new URL(normalizePath(envelope.data.returnPath || nextPath), publicOrigin(request));
  const result = NextResponse.redirect(destination, 302);
  result.cookies.set(EVENT_SESSION_COOKIE, envelope.data.eventSessionToken, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: new Date(envelope.data.expiresAt),
  });
  return result;
}

function normalizePath(value: string | null | undefined) {
  if (!value) return "/events/welcome";
  const parsed = new URL(value, "https://event.local");
  return parsed.pathname.startsWith("/events/") ? `${parsed.pathname}${parsed.search}` : "/events/welcome";
}
function mainUrl() { return process.env.MODUDADAM_MAIN_URL || "http://localhost:3005"; }
function publicOrigin(request: NextRequest) {
  if (process.env.MODUDADAM_EVENT_URL) return process.env.MODUDADAM_EVENT_URL;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return "http://localhost:3006";
  const protocol = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
