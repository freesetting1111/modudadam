import { listPublicEvents } from "@/domains/events/events.service";
import { corsPreflightResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export async function GET() {
  return jsonResponse({ events: await listPublicEvents() }, { headers: { "Cache-Control": "public, max-age=60" } });
}
export function OPTIONS() { return corsPreflightResponse(); }
