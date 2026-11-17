import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET() {
  const result = await query<{ query: string }>(
    `WITH recent_unique_searches AS (
       SELECT query,user_id,MIN(created_at) AS first_searched_at
       FROM search_logs
       WHERE created_at>=now()-interval '24 hours' AND user_id IS NOT NULL
       GROUP BY query,user_id
     )
     SELECT query
     FROM (
       SELECT query,COUNT(*) AS search_count,MIN(first_searched_at) AS first_searched_at
       FROM recent_unique_searches
       GROUP BY query
     ) ranked
     ORDER BY search_count DESC,first_searched_at ASC,query ASC
     LIMIT 10`,
  );
  return jsonResponse({ popularQueries: result.rows.map((row) => row.query) });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    const body = await request.json();
    const searchQuery = normalizeSearchQuery(body.query);
    if (!searchQuery) return errorResponse("검색어를 입력해 주세요.");

    await query("INSERT INTO search_logs(user_id,query) VALUES($1,$2)", [user?.id || null, searchQuery]);
    await query(
      `WITH stats AS (
         SELECT $1::varchar(80) AS query,COUNT(DISTINCT user_id)::integer AS search_count,
           MAX(created_at) AS last_searched_at
         FROM search_logs
         WHERE query=$1 AND user_id IS NOT NULL AND created_at>=now()-interval '24 hours'
       )
       INSERT INTO search_terms(query,search_count,last_searched_at)
       SELECT query,search_count,COALESCE(last_searched_at,now()) FROM stats WHERE search_count>0
       ON CONFLICT(query) DO UPDATE SET search_count=EXCLUDED.search_count,
         last_searched_at=EXCLUDED.last_searched_at,updated_at=now()`,
      [searchQuery],
    );
    return jsonResponse({ recorded: true }, { status: 201 });
  } catch (error) {
    console.error("[searches] failed to record search", error);
    return errorResponse("검색 기록을 저장하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }

function normalizeSearchQuery(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}
