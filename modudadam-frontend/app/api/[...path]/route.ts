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
  requestHeaders.set("x-forwarded-host", request.nextUrl.host);
  requestHeaders.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

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
