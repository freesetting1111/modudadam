import { query } from "@/lib/db";
import { corsPreflightResponse, jsonResponse } from "@/lib/http";

export async function GET() {
  const result = await query(
    `SELECT categories.id,categories.code,categories.name,categories.icon,categories.description,
      categories.sort_order AS "sortOrder",boards.id AS "boardId",boards.write_permission AS "writePermission"
     FROM categories LEFT JOIN boards ON boards.category_id=categories.id AND boards.is_active=true
     WHERE categories.is_active=true ORDER BY categories.sort_order`,
  );
  return jsonResponse({ categories: result.rows });
}
export function OPTIONS() { return corsPreflightResponse(); }
