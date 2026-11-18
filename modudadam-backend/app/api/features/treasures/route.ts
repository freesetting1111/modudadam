import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { query } from "@/lib/db";

const TYPES = new Set(["walk", "food", "pet", "rest", "photo", "helpful"]);

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const requestedPage = Number(request.nextUrl.searchParams.get("page") || "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 20;
  const validType = type && TYPES.has(type) ? type : null;
  const count = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM local_treasures
      WHERE status='published' AND ($1::text IS NULL OR treasure_type=$1)`,
    [validType],
  );
  const totalItems = Number(count.rows[0]?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const result = await query(
    `SELECT treasures.id,treasures.title,treasures.treasure_type AS "treasureType",treasures.description,
       treasures.address,treasures.latitude::float8 AS latitude,treasures.longitude::float8 AS longitude,
       treasures.created_at AS "createdAt",users.nickname AS "authorName",user_stamp_emoji(users.id) AS "authorStampEmoji"
     FROM local_treasures treasures JOIN users ON users.id=treasures.author_id
     WHERE treasures.status='published' AND ($1::text IS NULL OR treasures.treasure_type=$1)
     ORDER BY treasures.created_at DESC LIMIT $2 OFFSET $3`,
    [validType, pageSize, (currentPage - 1) * pageSize],
  );
  return jsonResponse({ treasures: result.rows, page: currentPage, pageSize, totalItems, totalPages });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const treasureType = String(body.treasureType || "");
    const description = String(body.description || "").trim();
    const address = String(body.address || "").trim();
    const latitude = optionalCoordinate(body.latitude, -90, 90);
    const longitude = optionalCoordinate(body.longitude, -180, 180);
    if (!title || title.length > 100) return errorResponse("장소 이름은 1자 이상 100자 이하로 입력해 주세요.");
    if (!TYPES.has(treasureType)) return errorResponse("장소 유형을 선택해 주세요.");
    if (!description || description.length > 1000) return errorResponse("소개는 1자 이상 1,000자 이하로 입력해 주세요.");
    if (!address || address.length > 300) return errorResponse("주소를 입력해 주세요.");
    if (latitude === undefined || longitude === undefined || (latitude === null) !== (longitude === null)) return errorResponse("위치 정보가 올바르지 않습니다.");
    const saved = await query(
      `INSERT INTO local_treasures(author_id,title,treasure_type,description,address,latitude,longitude)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,title,treasure_type AS "treasureType",description,address,
         latitude::float8 AS latitude,longitude::float8 AS longitude,created_at AS "createdAt"`,
      [user.id, title, treasureType, description, address, latitude, longitude],
    );
    return jsonResponse({ ...saved.rows[0], authorName: user.nickname, authorStampEmoji: user.stampEmoji }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    return errorResponse("동네 보물을 등록하지 못했습니다.", 500);
  }
}

function optionalCoordinate(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}
export function OPTIONS() { return corsPreflightResponse(); }
