import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createOAuthLoginTicket, type OAuthProfile, type OAuthProvider } from "./auth.repository";

const configs = {
  kakao: {
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    clientId: () => process.env.KAKAO_CLIENT_ID,
    clientSecret: () => process.env.KAKAO_CLIENT_SECRET,
    redirectUri: () => process.env.KAKAO_REDIRECT_URI,
  },
  naver: {
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    clientId: () => process.env.NAVER_CLIENT_ID,
    clientSecret: () => process.env.NAVER_CLIENT_SECRET,
    redirectUri: () => process.env.NAVER_REDIRECT_URI,
  },
} satisfies Record<OAuthProvider, object>;

export function startOAuth(provider: OAuthProvider, request: NextRequest) {
  const config = configs[provider];
  const clientId = config.clientId();
  const redirectUri = config.redirectUri();
  if (!clientId || !redirectUri) {
    return NextResponse.json({ success: false, error: { message: `${provider} OAuth 설정이 필요합니다.` } }, { status: 503 });
  }

  const nonce = randomUUID();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const state = Buffer.from(JSON.stringify({ nonce, returnTo }), "utf8").toString("base64url");
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  if (provider === "kakao") url.searchParams.set("scope", "account_email");

  const response = NextResponse.redirect(url);
  response.cookies.set(`${provider}_oauth_state`, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}

export async function handleOAuthCallback(provider: OAuthProvider, request: NextRequest) {
  const successUrl = process.env.OAUTH_SUCCESS_REDIRECT_URL || "http://localhost:3005";
  const failureUrl = process.env.OAUTH_FAILURE_REDIRECT_URL || `${successUrl}/login`;
  try {
    const code = request.nextUrl.searchParams.get("code");
    const encodedState = request.nextUrl.searchParams.get("state");
    const state = decodeState(encodedState);
    const storedNonce = request.cookies.get(`${provider}_oauth_state`)?.value;
    if (!code || !state || !storedNonce || state.nonce !== storedNonce) throw new Error("잘못된 OAuth state입니다.");

    const accessToken = await exchangeToken(provider, code, encodedState || "");
    const profile = await fetchProfile(provider, accessToken);
    const { ticket, requiresAgreement } = await createOAuthLoginTicket(profile, state.returnTo || "/");
    const nextPath = requiresAgreement ? "/signup/agreements" : "/api/auth/oauth/finalize";
    const nextUrl = new URL(nextPath, successUrl);
    nextUrl.searchParams.set("ticket", ticket);
    const response = NextResponse.redirect(nextUrl);
    response.cookies.delete(`${provider}_oauth_state`);
    return response;
  } catch (error) {
    console.error(`[OAuth:${provider}]`, error);
    const url = new URL(failureUrl);
    url.searchParams.set("oauthError", "callback_failed");
    url.searchParams.set("provider", provider);
    return NextResponse.redirect(url);
  }
}

async function exchangeToken(provider: OAuthProvider, code: string, state: string) {
  const config = configs[provider];
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId() || "",
    redirect_uri: config.redirectUri() || "",
    code,
  });
  if (provider === "naver") body.set("state", state);
  if (config.clientSecret()) body.set("client_secret", config.clientSecret() || "");
  const response = await fetch(config.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(`${provider} token 교환 실패`);
  return result.access_token as string;
}

async function fetchProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
  if (provider === "kakao") {
    const response = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    if (!response.ok) throw new Error("카카오 프로필 조회 실패");
    const account = body.kakao_account;
    const nickname = account?.profile?.nickname;
    const avatarUrl = account?.profile?.profile_image_url;
    const emailVerified = account?.is_email_valid === true && account?.is_email_verified === true;
    const email = emailVerified && typeof account?.email === "string"
      ? account.email.trim().toLowerCase()
      : undefined;
    return { provider, providerUserId: String(body.id), nickname, avatarUrl, email, emailVerified,
      raw: { id: body.id, nickname, profileImage: avatarUrl } };
  }
  const response = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json();
  if (!response.ok || body.resultcode !== "00") throw new Error("네이버 프로필 조회 실패");
  const nickname = body.response.nickname || body.response.name;
  const avatarUrl = body.response.profile_image;
  const email = typeof body.response.email === "string"
    ? body.response.email.trim().toLowerCase()
    : undefined;
  return { provider, providerUserId: body.response.id, nickname, avatarUrl, email, emailVerified: Boolean(email),
    raw: { id: body.response.id, nickname, profileImage: avatarUrl } };
}

function decodeState(value: string | null) {
  try {
    const result = JSON.parse(Buffer.from(value || "", "base64url").toString("utf8"));
    return typeof result.nonce === "string" ? { nonce: result.nonce, returnTo: safeReturnTo(result.returnTo) } : null;
  } catch { return null; }
}

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/api/")
    ? value : null;
}
