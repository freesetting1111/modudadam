import { cookies } from "next/headers";
import { API_BASE_URL } from "./config";

export type SessionUser = {
  id: string;
  nickname: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

type MeResponse = {
  success: true;
  data: { user: SessionUser | null };
};

export async function getServerSessionUser() {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json() as MeResponse;
    return body.success ? body.data.user : null;
  } catch {
    return null;
  }
}
