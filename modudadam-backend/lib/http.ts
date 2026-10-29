const allowedOrigin = process.env.FRONTEND_URL ?? "http://localhost:3005";

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
  };
}

export function jsonResponse<T>(data: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);

  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }

  return Response.json(
    {
      success: true,
      data,
    },
    {
      ...init,
      headers,
    },
  );
}

export function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
