import { corsPreflightResponse, jsonResponse } from "@/lib/http";

export function GET() {
  return jsonResponse({
    status: "ok",
    service: "modudadam-backend",
    timestamp: new Date().toISOString(),
  });
}

export function OPTIONS() {
  return corsPreflightResponse();
}
