import { NextRequest, NextResponse } from "next/server";
import { EVENT_SESSION_COOKIE } from "@/shared/event-session";

export const runtime = "nodejs";
const backendUrl = (process.env.MODUDADAM_BACKEND_URL || "http://localhost:3004").replace(/\/$/, "");
type Context = { params: Promise<{ path: string[] }> };

export function GET(request: NextRequest, context: Context) { return proxy(request, context); }
export function POST(request: NextRequest, context: Context) { return proxy(request, context); }
export function PUT(request: NextRequest, context: Context) { return proxy(request, context); }
export function PATCH(request: NextRequest, context: Context) { return proxy(request, context); }
export function DELETE(request: NextRequest, context: Context) { return proxy(request, context); }

async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const target = new URL(`/api/${path.join("/")}`, backendUrl);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  for (const name of ["host", "connection", "content-length"]) headers.delete(name);
  const token = request.cookies.get(EVENT_SESSION_COOKIE)?.value;
  if (token) headers.set("x-modudadam-event-session", token);
  const response = await fetch(target, {
    method: request.method, headers, cache: "no-store", redirect: "manual",
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
  });
  const responseHeaders = new Headers(response.headers);
  for (const name of ["content-encoding", "content-length", "transfer-encoding"]) responseHeaders.delete(name);
  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}
