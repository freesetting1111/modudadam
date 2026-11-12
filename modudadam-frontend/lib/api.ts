type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: { message: string } };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !body.success) {
    const message = body.success ? "요청을 처리하지 못했습니다." : body.error.message;
    throw new ApiError(message, response.status);
  }
  return body.data;
}
