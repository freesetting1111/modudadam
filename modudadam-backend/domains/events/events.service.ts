import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  consumeEntryTicket, createEntryTicket, findActiveUserBySessionHash,
  findEventByNo, findPublicEvents, validateEventSession,
} from "./events.repository";

const TICKET_TTL_MS = 2 * 60 * 1000;
const LAUNCH_TTL_MS = 60 * 1000;
const LOCAL_SECRET = "local-modudadam-event-gateway-secret";

export class EventError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "EventError";
  }
}

export async function createEventEntryRedirect(request: NextRequest, eventNo: string) {
  const event = await findEventByNo(eventNo);
  if (!event || !isActive(event)) throw new EventError("진행 중인 이벤트가 아닙니다.", 404, "event_inactive");
  const nextPath = normalizePath(request.nextUrl.searchParams.get("next"), event.entry_path, event.result_path);
  const launch = verifyLaunchToken(request.nextUrl.searchParams.get("launchToken"), eventNo, nextPath);
  const userId = launch.sessionHash ? await findActiveUserBySessionHash(launch.sessionHash) : null;
  if (launch.sessionHash && !userId) throw new EventError("로그인 세션이 만료되었습니다.", 401, "session_expired");
  const ticket = randomToken();
  await createEntryTicket({
    eventId: event.id, ticketHash: hash(ticket), userId, sourceSessionHash: launch.sessionHash,
    returnPath: nextPath,
    sourcePath: request.nextUrl.searchParams.get("source") || request.headers.get("referer"),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"), expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  });
  const baseUrl = resolveEventBaseUrl(event);
  const redirectUrl = new URL("/api/event-entry", baseUrl);
  redirectUrl.searchParams.set("ticket", ticket);
  redirectUrl.searchParams.set("next", nextPath);
  return redirectUrl.toString();
}

export async function consumeEventTicket(ticket: string) {
  const sessionToken = randomToken();
  const result = await consumeEntryTicket(hash(ticket), hash(sessionToken));
  if (!result.ok) throw new EventError("이벤트 진입 권한을 확인할 수 없습니다.", 401, result.reason);
  return { eventNo: result.eventNo, eventSessionToken: sessionToken,
    returnPath: result.returnPath, expiresAt: result.expiresAt.toISOString() };
}

export async function validateEventSessionToken(eventNo: string, token: string) {
  const session = await validateEventSession(eventNo, hash(token));
  if (!session) throw new EventError("이벤트 세션이 유효하지 않습니다.", 401, "invalid_event_session");
  return { eventNo: session.event_no, userId: session.user_id, expiresAt: new Date(session.expires_at).toISOString() };
}

export async function requireEventRequestSession(request: NextRequest, eventNo: string) {
  const token = request.headers.get("x-modudadam-event-session");
  if (!token) throw new EventError("이벤트 세션이 필요합니다.", 401, "missing_event_session");
  return validateEventSessionToken(eventNo, token);
}

export async function listPublicEvents() {
  const events = await findPublicEvents();
  return events.map((event) => ({
    eventNo: event.event_no, slug: event.slug, title: event.title,
    description: event.description, badge: event.badge, thumbnailUrl: event.thumbnail_url,
    entryPath: event.entry_path, participantCount: Number(event.participant_count || 0),
  }));
}

function verifyLaunchToken(token: string | null, eventNo: string, nextPath: string) {
  if (!token) throw new EventError("이벤트 진입 토큰이 필요합니다.", 401, "missing_launch_token");
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new EventError("이벤트 진입 토큰이 올바르지 않습니다.", 401, "invalid_launch_token");
  const expected = createHmac("sha256", gatewaySecret()).update(body).digest("base64url");
  const left = Buffer.from(signature); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new EventError("이벤트 진입 토큰 서명이 올바르지 않습니다.", 401, "invalid_launch_token");
  }
  let payload: { eventNo?: string; nextPath?: string; sessionHash?: string | null; iat?: number };
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); }
  catch { throw new EventError("이벤트 진입 토큰을 읽을 수 없습니다.", 401, "invalid_launch_token"); }
  if (payload.eventNo !== eventNo || payload.nextPath !== nextPath || typeof payload.iat !== "number" ||
      Math.abs(Date.now() - payload.iat) > LAUNCH_TTL_MS) {
    throw new EventError("이벤트 진입 토큰이 만료되었거나 일치하지 않습니다.", 401, "invalid_launch_token");
  }
  return { sessionHash: payload.sessionHash || null };
}

function normalizePath(value: string | null, entryPath: string, resultPath: string | null) {
  if (!value) return entryPath;
  const parsed = new URL(value, "https://event.local");
  if (parsed.pathname !== entryPath && parsed.pathname !== resultPath) return entryPath;
  return `${parsed.pathname}${parsed.search}`;
}

function isActive(event: { status: string; starts_at: Date | string | null; ends_at: Date | string | null }) {
  const now = new Date();
  return event.status === "active" && (!event.starts_at || new Date(event.starts_at) <= now) &&
    (!event.ends_at || new Date(event.ends_at) >= now);
}

function resolveEventBaseUrl(event: { event_base_url: string | null; local_event_base_url: string | null }) {
  const configuredUrl = process.env.MODUDADAM_EVENT_URL?.trim();
  if (configuredUrl) return configuredUrl;

  if (process.env.NODE_ENV === "production") {
    if (event.event_base_url && !isLocalUrl(event.event_base_url)) return event.event_base_url;
    throw new EventError(
      "운영 이벤트 주소가 설정되지 않았습니다.",
      500,
      "missing_event_base_url",
    );
  }

  return event.local_event_base_url || event.event_base_url || "http://localhost:3006";
}

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

function gatewaySecret() {
  if (process.env.EVENT_GATEWAY_SHARED_SECRET) return process.env.EVENT_GATEWAY_SHARED_SECRET;
  if (process.env.NODE_ENV === "production") throw new EventError("이벤트 게이트웨이 비밀키가 없습니다.", 500, "missing_gateway_secret");
  return LOCAL_SECRET;
}
function randomToken() { return randomBytes(32).toString("hex"); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
