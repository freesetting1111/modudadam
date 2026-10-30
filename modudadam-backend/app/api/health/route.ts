import { corsPreflightResponse, jsonResponse } from "@/lib/http";
import { query } from "@/lib/db";

export async function GET() {
  let database = "connected";
  try { await query("SELECT 1"); } catch { database = "unavailable"; }
  return jsonResponse({
    status: database === "connected" ? "ok" : "degraded",
    database,
    service: "modudadam-backend",
    timestamp: new Date().toISOString(),
  });
}

export function OPTIONS() {
  return corsPreflightResponse();
}
