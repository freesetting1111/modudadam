import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { corsPreflightResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 50000);
  const requestedOffset = Number(request.nextUrl.searchParams.get("offset") || 0);
  const limit = Number.isInteger(requestedLimit) ? Math.min(50000, Math.max(1, requestedLimit)) : 50000;
  const offset = Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;
  const result = await query<{ id: string; updatedAt: string }>(
    `SELECT id,updated_at AS "updatedAt" FROM posts
     WHERE status='published' ORDER BY id LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return jsonResponse({ posts: result.rows }, { headers: { "Cache-Control": "public, max-age=300" } });
}

export function OPTIONS() { return corsPreflightResponse(); }
