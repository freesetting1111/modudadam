import { NextRequest } from "next/server";
import { revokeSession } from "@/domains/auth/auth.repository";
import { SESSION_COOKIE } from "@/domains/auth/session";
import { corsPreflightResponse, jsonResponse } from "@/lib/http";
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  const response = jsonResponse({ loggedOut: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return response;
}
export function OPTIONS() { return corsPreflightResponse(); }
