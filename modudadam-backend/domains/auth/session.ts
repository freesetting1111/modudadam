import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";

export const SESSION_COOKIE = "modudadam_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  nickname: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<{
    id: string; nickname: string; email: string | null; avatar_url: string | null; role: string;
  }>(
    `SELECT users.id,COALESCE(account.login_id,users.nickname) AS nickname,users.email,users.avatar_url,users.role
     FROM user_sessions sessions
     JOIN users ON users.id = sessions.user_id
     LEFT JOIN user_local_accounts account ON account.user_id=users.id
     WHERE sessions.token_hash = $1 AND sessions.revoked_at IS NULL
       AND sessions.expires_at > now() AND users.status = 'active'`,
    [hashToken(token)],
  );
  const user = result.rows[0];
  return user ? { id: user.id, nickname: user.nickname, email: user.email, avatarUrl: user.avatar_url, role: user.role } : null;
}

export async function requireSessionUser(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
