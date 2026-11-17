import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type TrendingQuery = {
  query: string;
  searchCount: number;
  currentRank: number;
  previousRank: number | null;
  rankChange: number | null;
  direction: "up" | "same" | "down" | "new";
};

export async function GET() {
  const result = await query<TrendingQuery>(
    `WITH identified AS (
       SELECT query,created_at,
         CASE
           WHEN user_id IS NOT NULL THEN 'user:' || user_id::text
           WHEN anonymous_id IS NOT NULL THEN 'anonymous:' || anonymous_id::text
         END AS identity_key
       FROM search_logs
       WHERE created_at >= now() - interval '48 hours'
     ), current_counts AS (
       SELECT query,COUNT(DISTINCT identity_key)::int AS search_count,MAX(created_at) AS last_searched_at
       FROM identified
       WHERE identity_key IS NOT NULL AND created_at >= now() - interval '24 hours'
       GROUP BY query
     ), previous_counts AS (
       SELECT query,COUNT(DISTINCT identity_key)::int AS search_count,MAX(created_at) AS last_searched_at
       FROM identified
       WHERE identity_key IS NOT NULL
         AND created_at >= now() - interval '48 hours'
         AND created_at < now() - interval '24 hours'
       GROUP BY query
     ), current_ranked AS (
       SELECT query,search_count,
         ROW_NUMBER() OVER(ORDER BY search_count DESC,last_searched_at DESC,query ASC)::int AS current_rank
       FROM current_counts
     ), previous_ranked AS (
       SELECT query,
         ROW_NUMBER() OVER(ORDER BY search_count DESC,last_searched_at DESC,query ASC)::int AS previous_rank
       FROM previous_counts
     )
     SELECT current.query,current.search_count AS "searchCount",current.current_rank AS "currentRank",
       previous.previous_rank AS "previousRank",
       CASE WHEN previous.previous_rank IS NULL THEN NULL ELSE previous.previous_rank-current.current_rank END AS "rankChange",
       CASE
         WHEN previous.previous_rank IS NULL THEN 'new'
         WHEN previous.previous_rank > current.current_rank THEN 'up'
         WHEN previous.previous_rank < current.current_rank THEN 'down'
         ELSE 'same'
       END AS direction
     FROM current_ranked current
     LEFT JOIN previous_ranked previous USING(query)
     ORDER BY current.current_rank
     LIMIT 10`,
  );
  return jsonResponse({ trendingQueries: result.rows });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    const body = await request.json();
    const searchQuery = normalizeSearchQuery(body.query);
    if (!searchQuery) return errorResponse("검색어를 입력해 주세요.");
    const anonymousId = normalizeAnonymousId(body.anonymousId);

    if (user?.id || anonymousId) {
      await query("INSERT INTO search_logs(user_id,anonymous_id,query) VALUES($1,$2::uuid,$3)", [user?.id || null, anonymousId, searchQuery]);
    }
    await query(
      `WITH stats AS (
         SELECT $1::varchar(80) AS query,
           COUNT(DISTINCT CASE
             WHEN user_id IS NOT NULL THEN 'user:' || user_id::text
             WHEN anonymous_id IS NOT NULL THEN 'anonymous:' || anonymous_id::text
           END)::integer AS search_count,
           MAX(created_at) AS last_searched_at
         FROM search_logs
         WHERE query=$1 AND (user_id IS NOT NULL OR anonymous_id IS NOT NULL) AND created_at>=now()-interval '24 hours'
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

function normalizeAnonymousId(value: unknown) {
  const normalized = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ? normalized : null;
}
