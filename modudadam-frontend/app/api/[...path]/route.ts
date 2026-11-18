import { isIP } from "node:net";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

const methodsWithBody = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function proxyError(message: string, status: number) {
  return Response.json(
    { success: false, error: { message } },
    { status },
  );
}

async function proxyRequest(request: NextRequest, context: ProxyContext) {
  const configuredApiUrl = process.env.API_URL?.trim();
  if (!configuredApiUrl) {
    return proxyError("프론트엔드 서버에 API_URL 환경변수가 설정되지 않았습니다.", 503);
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredApiUrl);
  } catch {
    return proxyError("API_URL 환경변수의 주소 형식이 올바르지 않습니다.", 503);
  }

  const { path } = await context.params;
  const targetUrl = new URL(`/api/${path.join("/")}`, apiUrl);
  targetUrl.search = request.nextUrl.search;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("host");
  requestHeaders.delete("content-length");
  requestHeaders.delete("connection");
  requestHeaders.delete("x-modudadam-client-ip");
  requestHeaders.set("x-forwarded-host", request.nextUrl.host);
  requestHeaders.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  const clientIp = getIncomingClientIp(request);
  if (clientIp) requestHeaders.set("x-modudadam-client-ip", clientIp);

  try {
    const body = methodsWithBody.has(request.method)
      ? await request.arrayBuffer()
      : undefined;
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[api-proxy] ${request.method} ${targetUrl.pathname}`, error);
    return proxyError("백엔드 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }
}

function getIncomingClientIp(request: NextRequest) {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
  ];

  for (const header of candidates) {
    for (const rawValue of header?.split(",") || []) {
      const value = normalizeIp(rawValue);
      if (value) return value;
    }
  }
  return null;
}

function normalizeIp(rawValue: string) {
  let value = rawValue.trim();
  if (value.startsWith("[") && value.includes("]")) value = value.slice(1, value.indexOf("]"));
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
  return isIP(value) ? value : null;
}

export function GET(request: NextRequest, context: ProxyContext) {
  return proxyRequest(request, context);
}

export function POST(request: NextRequest, context: ProxyContext) {
  return proxyRequest(request, context);
}

export function PUT(request: NextRequest, context: ProxyContext) {
  return proxyRequest(request, context);
}

export function PATCH(request: NextRequest, context: ProxyContext) {
  return proxyRequest(request, context);
}

export function DELETE(request: NextRequest, context: ProxyContext) {
  return proxyRequest(request, context);
}

export function OPTIONS(request: NextRequest, context: ProxyContext) {
  return proxyRequest(request, context);
}
