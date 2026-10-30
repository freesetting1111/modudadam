import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, jsonResponse } from "@/lib/http";
export async function GET(request: NextRequest) { return jsonResponse({ user: await getSessionUser(request) }); }
export function OPTIONS() { return corsPreflightResponse(); }
