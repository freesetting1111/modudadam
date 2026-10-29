import { corsPreflightResponse, jsonResponse } from "@/lib/http";

export function GET() {
  return jsonResponse({
    name: "modudadam-backend",
    version: "0.1.0",
    endpoints: {
      health: "/api/health",
    },
  });
}

export function OPTIONS() {
  return corsPreflightResponse();
}
